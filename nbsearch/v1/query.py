from bson.objectid import ObjectId
import dateutil.parser


def nq_from_q(q):
    return {
      'target': {'type': 'all', 'text': q}
    }

def nq_from_meme(meme):
    return {
      'cell': {
        'and': [{'in_meme': meme}]
      }
    }

async def mongo_target_query_from_nq(nq_target, history, notebooks):
    cond = {}
    if 'text' in nq_target:
        cond['$text'] = {'$search': nq_target['text']}
    if 'history_in' in nq_target:
        history_obj = await history.find_one({'_id': ObjectId(nq_target['history_in'])})
        notebook_ids = [ObjectId(id) for id in history_obj['notebook_ids']]
        cond['_id'] = {'$in': notebook_ids}
    if 'history_related' in nq_target:
        history_obj = await history.find_one({'_id': ObjectId(nq_target['history_related'])})
        notebook_ids = [ObjectId(id) for id in history_obj['notebook_ids']]
        cell_ids_result = notebooks.aggregate([
          {'$match': {'_id': {'$in': notebook_ids}}},
          {'$unwind': '$cells'},
          {'$project': {'meme': '$cells.metadata.lc_cell_meme.current'}},
          {'$match': {'meme': {'$ne': None}}},
          {'$project': {'meme': {'$substr': ['$meme', 0, 36]}}},
          {'$group': {'_id': '$meme', 'count': {'$sum': 1}}},
          {'$match': {'count': {'$gt': 1}}},
          {'$sort': {'count': -1}}])
        cell_ids = []
        async for doc in cell_ids_result:
            cell_ids.append(doc)
        cond['cells'] = {'$elemMatch': {'$or': [{'metadata.lc_cell_meme.current': {'$regex': '^{}.*'.format(cid['_id'])}} for cid in cell_ids]}}
    return cond

def to_regex(substr, not_condition=False):
    q = {'$regex': '.*{}.*'.format(substr)}
    if not not_condition:
        return q
    return {'$not': q}

def to_string_query(values):
    if 'eq' in values:
        return values['eq']
    if 'in' in values:
        return to_regex(values['in'])
    if 'not' in values:
        return {'$ne': values['not']}
    if 'not_in' in values:
        return to_regex(values['not_in'], not_condition=True)
    raise ValueError(values)

def to_datetime_query(values):
    if 'lt' in values:
        return {'$lt': dateutil.parser.parse(values['lt'])}
    if 'gt' in values:
        return {'$gt': dateutil.parser.parse(values['gt'])}
    if 'lte' in values:
        return {'$lte': dateutil.parser.parse(values['lte'])}
    if 'gte' in values:
        return {'$gte': dateutil.parser.parse(values['gte'])}
    raise ValueError(values)

def mongo_notebook_query_from_nq(nq_notebook):
    cond = {}
    if 'path' in nq_notebook:
        cond['path'] = to_string_query(nq_notebook['path'])
    if 'server' in nq_notebook:
        cond['server'] = to_string_query(nq_notebook['server'])
    if 'mtime' in nq_notebook:
        cond['mtime'] = to_datetime_query(nq_notebook['mtime'])
    return cond

def _mongo_cell_query_element_from_nq(key, match, not_condition=False):
    cellq = {}
    if key == 'meme':
        cellq['metadata.lc_cell_meme.current'] = {'$ne': match['meme']} if not_condition else match['meme']
    elif key == 'in_meme':
        cellq['metadata.lc_cell_meme.current'] = to_regex(match['in_meme'], not_condition=not_condition)
    elif key == 'prev_meme':
        cellq['metadata.lc_cell_meme.previous'] = {'$ne': match['prev_meme']} if not_condition else match['prev_meme']
    elif key == 'in_prev_meme':
        cellq['metadata.lc_cell_meme.previous'] = to_regex(match['in_prev_meme'], not_condition=not_condition)
    elif key == 'next_meme':
        cellq['metadata.lc_cell_meme.next'] = {'$ne': match['next_meme']} if not_condition else match['next_meme']
    elif key == 'in_next_meme':
        cellq['metadata.lc_cell_meme.next'] = to_regex(match['in_next_meme'], not_condition=not_condition)
    elif key == 'in_code':
        q = {'cell_type': 'code', 'source': to_regex(match['in_code'], not_condition=not_condition)}
        cellq.update(q)
    elif key == 'in_markdown':
        q = {'cell_type': 'markdown', 'source': to_regex(match['in_markdown'], not_condition=not_condition)}
        cellq.update(q)
    elif key == 'in_output':
        cellq['cell.outputs.text'] = to_regex(match['in_output'], not_condition=not_condition)
    else:
        raise KeyError('Unexpected key: {}'.format(key))
    return cellq

def mongo_cell_query_element_from_nq(match):
    cellq = {}
    for key in match.keys():
        if key.startswith('not_'):
            partq = _mongo_cell_query_element_from_nq(key[4:], {key[4:]: match[key]}, not_condition=True)
        else:
            partq = _mongo_cell_query_element_from_nq(key, match)
        cellq.update(partq)
    return {
      'cells': {
        '$elemMatch': cellq
      }
    }

def mongo_cell_query_from_nq(nq_cell):
    cond = '$and' if 'and' in nq_cell else ('$or' if 'or' in nq_cell else None)
    if cond is None:
        return None
    matches = []
    for m in nq_cell['and'] if 'and' in nq_cell else nq_cell['or']:
        matches.append(mongo_cell_query_element_from_nq(m))
    return {cond: matches}

async def mongo_agg_query_from_nq(nq, history, notebooks):
    agg = []
    if 'target' in nq:
        q = await mongo_target_query_from_nq(nq['target'], history, notebooks)
        if q is not None:
            agg.append({'$match': q})
    if 'notebook' in nq:
        q = mongo_notebook_query_from_nq(nq['notebook'])
        if q is not None:
            agg.append({'$match': q})
    if 'cell' in nq:
        q = mongo_cell_query_from_nq(nq['cell'])
        if q is not None:
            agg.append({'$match': q})
    if len(agg) > 1 and all(['$match' in a for a in agg]):
        return [{'$match': {'$and': [a['$match'] for a in agg]}}]
    return agg
