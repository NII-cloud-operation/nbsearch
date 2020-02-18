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
  const q = url.searchParams.get('q');
  const meme = url.searchParams.get('meme');
  console.log(log_prefix, 'Loaded', q, meme);

  const query = q != null ? { q } : { meme };
  const start = url.searchParams.get('start');
  const limit = url.searchParams.get('limit');
  if (start) {
    query.start = start;
  }
  if (limit) {
    query.limit = limit;
  }

  $('#query').text(q != null ? `Query: ${q}` : `MEME: ${meme}`);
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
