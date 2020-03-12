def nq_from_q(q):
    return {
      'target': {'type': 'all', 'text': q}
    }

def nq_from_meme(meme):
    return {
      'cell': {
        'type': 'and',
        'patterns': [{'meme': meme}]
      }
    }

def mongo_target_query_from_nq(nq_target):
    assert 'type' not in nq_target or nq_target['type'] == 'all'
    cond = {}
    if 'text' in nq_target:
        cond['$text'] = {'$search': nq_target['text']}
    #if 'modified' in nq_target:
    #    cond['']
    return cond

def to_regex(substr):
    return '.*{}.*'.format(substr)

def mongo_cell_query_element_from_nq(match):
    cellq = {}
    if 'meme' in match:
        cellq['metadata.lc_cell_meme.current'] = match['meme']
    elif 'in_meme' in match:
        cellq['metadata.lc_cell_meme.current'] = {'$regex': to_regex(match['in_meme'])}
    if 'prev_meme' in match:
        cellq['metadata.lc_cell_meme.previous'] = match['prev_meme']
    elif 'in_prev_meme' in match:
        cellq['metadata.lc_cell_meme.previous'] = {'$regex': to_regex(match['in_prev_meme'])}
    if 'next_meme' in match:
        cellq['metadata.lc_cell_meme.next'] = match['next_meme']
    elif 'in_next_meme' in match:
        cellq['metadata.lc_cell_meme.next'] = {'$regex': to_regex(match['in_next_meme'])}
    if 'in_code' in match:
        cellq['cell_type'] = 'code'
        cellq['source'] = {'$regex': to_regex(match['in_code'])}
    if 'in_markdown' in match:
        cellq['cell_type'] = 'markdown'
        cellq['source'] = {'$regex': to_regex(match['in_markdown'])}
    if 'in_output' in match:
        cellq['cell.outputs.text'] = {'$regex': to_regex(match['in_output'])}
    return {
      'cells': {
        '$elemMatch': cellq
      }
    }

def mongo_cell_query_from_nq(nq_cell):
    assert 'type' not in nq_cell or nq_cell['type'] in ['and', 'or']
    cond = '$and' if 'type' not in nq_cell else '${}'.format(nq_cell['type'])
    matches = []
    for m in nq_cell['match']:
        matches.append(mongo_cell_query_element_from_nq(m))
    return {cond: matches}

def mongo_agg_query_from_nq(nq):
    agg = []
    if 'target' in nq:
        q = mongo_target_query_from_nq(nq['target'])
        if q is not None:
            agg.append({'$match': q})
    if 'cell' in nq:
        q = mongo_cell_query_from_nq(nq['cell'])
        if q is not None:
            agg.append({'$match': q})
    if len(agg) > 1 and all(['$match' in a for a in agg]):
        return [{'$match': {'$and': [a['$match'] for a in agg]}}]
    return agg
