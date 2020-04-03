define([
  'jquery',
  'require',
  'search',
], function(
  $,
  require,
  search,
) {
  const log_prefix = '[nbsearch]';
  const url = new URL(window.location);
  console.log(log_prefix, 'Initialized');

  const query = search.query_from_search_params(url.searchParams);
  const start = url.searchParams.get('start');
  const limit = url.searchParams.get('limit');
  if (start) {
    query.start = start;
  }
  if (limit) {
    query.limit = limit;
  }

  search.create_cell_query_ui(query)
    .then(ui => {
      $('#query').append(ui);
      const handle_search = () => {
        const baseq = search.get_cell_query(query.start, query.limit);
        search.execute(baseq)
          .then(newq => {
            console.log('SUCCESS', newq);
            query.start = newq.start;
            query.limit = newq.limit;
          })
          .catch(e => {
            console.error('ERROR', e);
          });
      };
      const search_button = $('<button></button>')
        .addClass('btn btn-primary')
        .text('Search');
      search_button.click(handle_search);
      $('#query').append(search_button);
    });

  $('.save-search').click(() => {
    const baseq = search.get_cell_query(query.start, query.limit);
    search.save(baseq, 'Test Result')
      .then(result => {
        console.log('SUCCESS', result);
      })
      .catch(e => {
        console.error('ERROR', e);
      });
  });

  $('.prev-page').click(() => {
    if (parseInt(query.start) <= 0) {
      return;
    }
    const baseq = search.get_cell_query(Math.min(parseInt(query.start) - parseInt(query.limit), 0).toString(), query.limit);
    search.execute(baseq)
      .then(newq => {
        console.log('SUCCESS', newq);
        query.start = newq.start;
        query.limit = newq.limit;
      })
      .catch(e => {
        console.error('ERROR', e);
      });
  });

  $('.next-page').click(() => {
    const baseq = search.get_cell_query((parseInt(query.start) + parseInt(query.limit)).toString(), query.limit);
    search.execute(baseq)
      .then(newq => {
        console.log('SUCCESS', newq);
        query.start = newq.start;
        query.limit = newq.limit;
      })
      .catch(e => {
        console.error('ERROR', e);
      });
    search.execute(query);
  });
});
