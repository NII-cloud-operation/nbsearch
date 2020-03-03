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

    let last_query = null;
    let base_href = null;

    function get_api_base_url() {
        const base_url = utils.get_body_data('baseUrl');
        return `${base_url}${base_url.endsWith('/') ? '' : '/'}nbsearch`;
    }

    function get_base_path() {
        const firstHref = window.location.href.split(/[?#]/)[0];
        const notebookPath = utils.get_body_data('notebookPath');
        console.log(log_prefix, 'URL: windown.location.href=' + firstHref +
                    ', notebookPath=' + notebookPath);
        const decodedHref = decodeURI(firstHref);
        const last = decodedHref.substring(decodedHref.length - notebookPath.length);
        if (last != notebookPath) {
            console.error(log_prefix, 'Unexpected path: ' + last +
                          ' (Expected: ' + notebookPath + ')');
            return null;
        }
        const encodedPath = encodeURI(notebookPath);
        return firstHref.substring(0, firstHref.length - encodedPath.length);
    }

    function create_link(notebook) {
        const loading_indicator = $('<i></i>')
            .attr('style', 'display: none;')
            .addClass('fa fa-spinner fa-pulse');
        const button = $('<button></button>').addClass('btn btn-link');
        button.click(() => {
            loading_indicator.show();
            const current_href = window.location.href.split(/[?#]/)[0];
            let path = current_href.substring(base_href.length);
            if (path.length > 0 && !path.startsWith('/')) {
                path = `/${path}`;
            }
            console.log(log_prefix, 'Destination', path);
            var jqxhr = $.getJSON(`${get_api_base_url()}/v1/import${path}/${notebook.id}`)
                .done(data => {
                    console.log('Imported', data);
                    loading_indicator.hide();
                })
                .fail(() => {
                    loading_indicator.hide();
                    $('#nbsearch-error-import').show();
                });
        });
        return button.text(notebook['path']).append(loading_indicator);
    }

    function create_page_button() {
        const prev_button = $('<button></button>')
            .addClass('btn btn-link btn-xs')
            .append($('<i></i>').addClass('fa fa-angle-left'));
        prev_button.click(() => {
            console.log(log_prefix, 'Previous', last_query);
            const query = Object.assign({}, last_query);
            if (parseInt(query.start) <= 0) {
              return;
            }
            query.start = Math.min(parseInt(query.start) - parseInt(query.limit), 0).toString();
            search.execute(query);
            last_query = query;
        });
        const next_button = $('<button></button>')
            .addClass('btn btn-link btn-xs')
            .append($('<i></i>').addClass('fa fa-angle-right'));
        next_button.click(() => {
            console.log(log_prefix, 'Next', last_query);
            const query = Object.assign({}, last_query);
            query.start = (parseInt(query.start) + parseInt(query.limit)).toString();
            search.execute(query);
            last_query = query;
        });
        const page_number = $('<span></span>')
            .addClass('nbsearch-page-number');
        return $('<div></div>')
            .append(prev_button)
            .append(page_number)
            .append(next_button);
    }

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
            last_query = query;
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
            .append(create_page_button())
            .append(list)
            .append(create_page_button());
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
        base_href = get_base_path();
        search.init(get_api_base_url(), 'nbsearch-', create_link);

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
