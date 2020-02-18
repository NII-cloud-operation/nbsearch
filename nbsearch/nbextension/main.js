define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'require',
    './search'
], function(
    $,
    Jupyter,
    utils,
    require,
    search,
) {
    "use strict";

    const mod_name = 'nbsearch';
    const log_prefix = '[' + mod_name + ']';

    const base_url = utils.get_body_data('baseUrl');
    search.init(`${base_url}${base_url.endsWith('/') ? '' : '/'}nbsearch`, 'nbsearch-');

    function create_ui() {
        const headers = ['Path', 'Server', 'MTime', 'ATime', '# of Cells'];
        const header_elems = headers.map(colname => $('<th></th>')
            .append(colname));

        const list = $('<table></table>')
            .addClass('table')
            .append($('<thead></thead>')
                .append(header_elems))
            .append($('<tbody></tbody>')
                .attr('id', 'nbsearch-result')
                .append($('<tr></tr>')
                    .append($('<td></td>')
                        .attr('colspan', headers.length)
                        .append('No result'))));
        const loading_indicator = $('<i></i>')
            .attr('id', 'nbsearch-loading')
            .attr('style', 'display: none;')
            .addClass('fa fa-spinner fa-pulse');
        const search_button = $('<button></button>')
            .addClass('btn btn-default btn-xs')
            .append($('<i></i>').addClass('fa fa-search'));
        search_button.click(() => {
            const query = { q: $('#nbsearch-query').val() };
            console.log(log_prefix, 'Search', query);
            search.execute(query);
        });

        const toolbar = $('<div></div>')
            .addClass('row list_toolbar')
            .append($('<div></div>')
                .addClass('col-sm-12 no-padding')
                .append('Query:')
                .append($('<input></input>')
                    .attr('id', 'nbsearch-query')
                    .attr('type', 'text'))
                .append(search_button)
                .append(loading_indicator));
        const error = $('<div></div>')
            .attr('id', 'nbsearch_error');
        return $('<div></div>')
            .append(error)
            .append(toolbar)
            .append(list);
    }

    function insert_tab() {
        var tab_text = 'NBSearch';
        var tab_id = 'nbsearch';

        $('<div/>')
            .attr('id', tab_id)
            .append(create_ui())
            .addClass('tab-pane')
            .appendTo('.tab-content');

        var tab_link = $('<a>')
            .text(tab_text)
            .attr('href', '#' + tab_id)
            .attr('data-toggle', 'tab')
            .on('click', function (evt) {
                window.history.pushState(null, null, '#' + tab_id);
            });

        $('<li>')
            .append(tab_link)
            .appendTo('#tabs');

        // select tab if hash is set appropriately
        if (window.location.hash == '#' + tab_id) {
            tab_link.click();
        }
    }

    function load_ipython_extension() {
        $('<link>')
            .attr('rel', 'stylesheet')
            .attr('type', 'text/css')
            .attr('href', require.toUrl('./main.css'))
            .appendTo('head');

        insert_tab();
    }

    return {
        load_ipython_extension : load_ipython_extension
    };
});
