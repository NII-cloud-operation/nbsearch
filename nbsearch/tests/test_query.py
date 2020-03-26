import mock
import pytest

from nbsearch.v1 import query


@pytest.mark.asyncio
async def test_mongo_query_from_q():
    nq = query.nq_from_q('QUERY')
    assert nq == {'target': {'text': 'QUERY', 'type': 'all'}}

    history = mock.Mock()
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$text': {'$search': 'QUERY'}}}]

@pytest.mark.asyncio
async def test_mongo_query_from_meme():
    nq = query.nq_from_meme('MEME')
    assert nq == {'cell': {'and': [{'in_meme': 'MEME'}]}}

    history = mock.Mock()
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'metadata.lc_cell_meme.current': {'$regex': '.*MEME.*'}}}}]}}]

@pytest.mark.asyncio
async def test_mongo_query_from_invalid_nq():
    history = mock.Mock()

    with pytest.raises(KeyError):
        nq = {'cell': {'and': [{'not_valid': 'OUTPUT'}]}}
        await query.mongo_agg_query_from_nq(nq, history)

@pytest.mark.asyncio
async def test_mongo_query_from_nq():
    history = mock.Mock()

    nq = {'cell': {'and': [{'in_code': 'CODE'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$regex': '.*CODE.*'}}}}]}}]

    nq = {'cell': {'and': [{'not_in_code': 'CODE'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$not': {'$regex': '.*CODE.*'}}}}}]}}]

    nq = {'cell': {'and': [{'not_in_code': 'CODE', 'in_output': 'OUTPUT'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$not': {'$regex': '.*CODE.*'}}, 'cell.outputs.text': {'$regex': '.*OUTPUT.*'}}}}]}}]

    nq = {'cell': {'and': [{'in_markdown': 'MARKDOWN'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'markdown', 'source': {'$regex': '.*MARKDOWN.*'}}}}]}}]

    nq = {'cell': {'and': [{'in_output': 'OUTPUT'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell.outputs.text': {'$regex': '.*OUTPUT.*'}}}}]}}]
