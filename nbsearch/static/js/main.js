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
  const qs = url.searchParams.get('qs');
  const q = url.searchParams.get('q');
  const meme = url.searchParams.get('meme');
  console.log(log_prefix, 'Loaded', qs, q, meme);

  const query = qs != null ? { qs } : (q != null ? { q } : { meme });
  const start = url.searchParams.get('start');
  const limit = url.searchParams.get('limit');
  if (start) {
    query.start = start;
  }
  if (limit) {
    query.limit = limit;
  }

  $('#query').text(qs != null ? `Composite: ${qs}` : (q != null ? `Query: ${q}` : `MEME: ${meme}`));
  search.execute(query);

  $('.prev-page').click(() => {
    if (parseInt(query.start) <= 0) {
      return;
    }
    query.start = Math.min(parseInt(query.start) - parseInt(query.limit), 0).toString();
    search.execute(query);
  });

  $('.next-page').click(() => {
    query.start = (parseInt(query.start) + parseInt(query.limit)).toString();
    search.execute(query);
  });
});
