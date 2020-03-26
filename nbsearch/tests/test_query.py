import mock
import pytest

from bson.objectid import ObjectId
from nbsearch.v1 import query

from .utils import AsyncMock, AsyncIterator


@pytest.mark.asyncio
async def test_mongo_query_from_q():
    nq = query.nq_from_q('QUERY')
    assert nq == {'target': {'text': 'QUERY', 'type': 'all'}}

    history = mock.Mock()
    notebooks = mock.Mock()
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$text': {'$search': 'QUERY'}}}]

@pytest.mark.asyncio
async def test_mongo_query_from_meme():
    nq = query.nq_from_meme('MEME')
    assert nq == {'cell': {'and': [{'in_meme': 'MEME'}]}}

    history = mock.Mock()
    notebooks = mock.Mock()
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'metadata.lc_cell_meme.current': {'$regex': '.*MEME.*'}}}}]}}]

@pytest.mark.asyncio
async def test_mongo_query_from_invalid_nq():
    history = mock.Mock()
    notebooks = mock.Mock()

    with pytest.raises(KeyError):
        nq = {'cell': {'and': [{'not_valid': 'OUTPUT'}]}}
        await query.mongo_agg_query_from_nq(nq, history, notebooks)

@pytest.mark.asyncio
async def test_mongo_cell_query_from_nq():
    history = mock.Mock()
    notebooks = mock.Mock()

    nq = {'cell': {'and': [{'in_code': 'CODE'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$regex': '.*CODE.*'}}}}]}}]

    nq = {'cell': {'and': [{'not_in_code': 'CODE'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$not': {'$regex': '.*CODE.*'}}}}}]}}]

    nq = {'cell': {'and': [{'not_in_code': 'CODE', 'in_output': 'OUTPUT'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'code', 'source': {'$not': {'$regex': '.*CODE.*'}}, 'cell.outputs.text': {'$regex': '.*OUTPUT.*'}}}}]}}]

    nq = {'cell': {'and': [{'in_markdown': 'MARKDOWN'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell_type': 'markdown', 'source': {'$regex': '.*MARKDOWN.*'}}}}]}}]

    nq = {'cell': {'and': [{'in_output': 'OUTPUT'}]}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$and': [{'cells': {'$elemMatch': {'cell.outputs.text': {'$regex': '.*OUTPUT.*'}}}}]}}]

@pytest.mark.asyncio
async def test_mongo_target_query_from_nq():
    history = mock.Mock()
    notebooks = mock.Mock()

    nq = {'target': {'text': 'TEXT', 'type': 'all'}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'$text': {'$search': 'TEXT'}}}]

    history.find_one = AsyncMock()
    history.find_one.return_value = {'notebook_ids': ['0123456789abcdef01234567', '123456789abcdef012345670']}

    nq = {'target': {'history_in': 'abcdef012345670123456789'}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    assert mongoq == [{'$match': {'_id': {'$in': [ObjectId('0123456789abcdef01234567'), ObjectId('123456789abcdef012345670')]}}}]

    notebooks.aggregate = mock.Mock()
    notebooks.aggregate.return_value = AsyncIterator([{'_id': 'MEME{0:04d}'.format(i)} for i in range(5)])

    nq = {'target': {'history_related': 'abcdef012345670123456789'}}
    mongoq = await query.mongo_agg_query_from_nq(nq, history, notebooks)
    print(mongoq)
    assert mongoq == [{'$match': {'cells': {'$elemMatch': {'$or': [
        {'metadata.lc_cell_meme.current': {'$regex': '^MEME0000.*'}},
        {'metadata.lc_cell_meme.current': {'$regex': '^MEME0001.*'}},
        {'metadata.lc_cell_meme.current': {'$regex': '^MEME0002.*'}},
        {'metadata.lc_cell_meme.current': {'$regex': '^MEME0003.*'}},
        {'metadata.lc_cell_meme.current': {'$regex': '^MEME0004.*'}}
    ]}}}}]
