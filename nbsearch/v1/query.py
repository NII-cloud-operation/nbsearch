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

async def mongo_target_query_from_nq(nq_target, history):
    cond = {}
    if 'text' in nq_target:
        cond['$text'] = {'$search': nq_target['text']}
    if 'history_in' in nq_target:
        history_obj = await history.find_one({'_id': ObjectId(nq_target['history_in'])})
        notebook_ids = [ObjectId(id) for id in history_obj['notebook_ids']]
        cond['_id'] = {'$in': notebook_ids}
    return cond

def to_regex(substr):
    return '.*{}.*'.format(substr)

def to_string_query(values):
    if 'eq' in values:
        return values['eq']
    if 'in' in values:
        return {'$regex': to_regex(values['in'])}
    if 'not' in values:
        return {'$not': values['not']}
    if 'not_in' in values:
        return {'$not': {'$regex': to_regex(values['not_in'])}}
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

def _mongo_cell_query_element_from_nq(key, match):
    cellq = {}
    if key == 'meme':
        cellq['metadata.lc_cell_meme.current'] = match['meme']
    elif key == 'in_meme':
        cellq['metadata.lc_cell_meme.current'] = {'$regex': to_regex(match['in_meme'])}
    elif key == 'prev_meme':
        cellq['metadata.lc_cell_meme.previous'] = match['prev_meme']
    elif key == 'in_prev_meme':
        cellq['metadata.lc_cell_meme.previous'] = {'$regex': to_regex(match['in_prev_meme'])}
    elif key == 'next_meme':
        cellq['metadata.lc_cell_meme.next'] = match['next_meme']
    elif key == 'in_next_meme':
        cellq['metadata.lc_cell_meme.next'] = {'$regex': to_regex(match['in_next_meme'])}
    elif key == 'in_code':
        cellq['cell_type'] = 'code'
        cellq['source'] = {'$regex': to_regex(match['in_code'])}
    elif key == 'in_markdown':
        cellq['cell_type'] = 'markdown'
        cellq['source'] = {'$regex': to_regex(match['in_markdown'])}
    elif key == 'in_output':
        cellq['cell.outputs.text'] = {'$regex': to_regex(match['in_output'])}
    else:
        raise KeyError('Unexpected key: {}'.format(key))
    return cellq

def mongo_cell_query_element_from_nq(match):
    not_cellq = {}
    cellq = {}
    for key in match.keys():
        if key.startswith('not_'):
            partq = _mongo_cell_query_element_from_nq(key[4:], {key[4:]: match[key]})
            not_cellq.update(partq)
        else:
            partq = _mongo_cell_query_element_from_nq(key, match)
            cellq.update(partq)
    if len(not_cellq) > 0 and len(cellq) == 0:
        cellq['$not'] = not_cellq
    elif len(not_cellq) > 0:
        cellq = {'$and': [cellq, {'$not': not_cellq}]}
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

async def mongo_agg_query_from_nq(nq, history):
    agg = []
    if 'target' in nq:
        q = await mongo_target_query_from_nq(nq['target'], history)
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
