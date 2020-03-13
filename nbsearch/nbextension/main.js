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

    let last_query = {};
    let base_href = null;
    let diff_selected = {};

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

    function get_diff_hanlder(checkbox, notebook) {
        return () => {
            if (checkbox.is(':checked')) {
                diff_selected[notebook.id] = notebook;
            } else {
                diff_selected[notebook.id] = null;
            }
            const notebooks = Object.entries(diff_selected).filter(v => v[1] !== null).map(v => v[1]);
            $('.nbsearch-diff-button').prop('disabled', notebooks.length == 0);
        };
    }

    function prepare_notebook(path, notebook) {
      return new Promise((resolve, reject) => {
          $.getJSON(`${get_api_base_url()}/v1/import${path}/${notebook.id}`)
              .done(data => {
                  resolve(data);
              })
              .fail(() => {
                  reject();
              });
      });
    }

    function create_link(notebook) {
        const loading_indicator = $('<i></i>')
            .attr('style', 'display: none;')
            .addClass('fa fa-spinner fa-pulse');
        const checkbox = $('<input></input>')
            .attr('type', 'checkbox')
            .addClass('nbsearch-diff');
        checkbox.change(get_diff_hanlder(checkbox, notebook));

        const button = $('<button></button>').addClass('btn btn-link');
        button.click(() => {
            loading_indicator.show();
            const current_href = window.location.href.split(/[?#]/)[0];
            let path = current_href.substring(base_href.length);
            if (path.length > 0 && !path.startsWith('/')) {
                path = `/${path}`;
            }
            console.log(log_prefix, 'Destination', path);
            prepare_notebook(path, notebook)
                .then(data => {
                    console.log('Imported', data);
                    loading_indicator.hide();
                })
                .catch(err => {
                    loading_indicator.hide();
                    $('#nbsearch-error-import').show();
                });
        });
        return $('<span></span>')
            .append(checkbox)
            .append(button.text(notebook['path']).append(loading_indicator));
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
            const baseq = search.get_cell_query(Math.min(parseInt(last_query.start) - parseInt(last_query.limit), 0).toString(), last_query.limit);
            search.execute(baseq)
                .then(newq => {
                    console.log('SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error('ERROR', e);
                });
        });
        const next_button = $('<button></button>')
            .addClass('btn btn-link btn-xs')
            .append($('<i></i>').addClass('fa fa-angle-right'));
        next_button.click(() => {
            console.log(log_prefix, 'Next', last_query);
            const baseq = search.get_cell_query((parseInt(last_query.start) + parseInt(last_query.limit)).toString(), last_query.limit);
            search.execute(baseq)
                .then(newq => {
                    console.log('SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error('ERROR', e);
                });
        });

        const diff_button = $('<button></button>')
            .addClass('btn btn-default btn-xs nbsearch-diff-button')
            .prop('disabled', true)
            .append($('<i></i>').addClass('fa fa-eye'))
            .append('Diff');
        diff_button.click(() => {
            const notebooks = Object.entries(diff_selected).filter(v => v[1] !== null).map(v => v[1]);
            console.log(notebooks);
            const promises = notebooks.map(notebook => {
                return prepare_notebook('/nbsearch-tmp', notebook);
            });
            Promise.all(promises)
                .then(values => {
                    // Open Diff
                    values.forEach((status, index) => {
                        $(`#diff-file${index}`).val(`nbsearch-tmp/${status.filename}`);
                    });
                    $('a[href="#notebook_diff"]').click();
                    setTimeout(() => {
                        $('#diff-search').click();
                    }, 10);
                })
                .catch(err => {
                    console.log(err);
                });
        });

        const save_button = $('<button></button>')
            .addClass('btn btn-default btn-xs nbsearch-save-button')
            .append($('<i></i>').addClass('fa fa-save'))
            .append('Save');
        save_button.click(() => {
            search.save(last_query, `Test ${last_query.nq}`)
                .then(result => {
                    console.log('SUCCESS', result);
                })
                .catch(e => {
                    console.error('ERROR', e);
                });
        });

        const page_number = $('<span></span>')
            .addClass('nbsearch-page-number');
        return $('<div></div>')
            .append(prev_button)
            .append(page_number)
            .append(next_button)
            .append(save_button)
            .append(diff_button);
    }

    async function create_ui() {
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
            .append($('<i></i>').addClass('fa fa-search'))
            .append('検索');
        search_button.click(() => {
            const baseq = search.get_cell_query(last_query.start, last_query.limit);
            search.execute(baseq)
                .then(newq => {
                    console.log('SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error('ERROR', e);
                });
        });

        const toolbar = $('<div></div>')
            .addClass('row list_toolbar')
            .append($('<div></div>')
                .addClass('col-sm-12 no-padding')
                .append(await search.create_cell_query_ui())
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

    async function insert_tab() {
        var tab_text = 'NBSearch';
        var tab_id = 'nbsearch';

        $('<div/>')
            .attr('id', tab_id)
            .append(await create_ui())
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

        insert_tab()
            .then(ui => {
                console.log('UI created', ui);
            });
    }

    return {
        load_ipython_extension : load_ipython_extension
    };
});
