define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'require',
    './search',
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
    const tab_id = 'nbsearch';

    let last_query = {};
    let base_href = null;
    let diff_selected = {};

    function get_api_base_url() {
        const base_url = utils.get_body_data('baseUrl');
        return `${base_url}${base_url.endsWith('/') ? '' : '/'}nbsearch`;
    }

    async function run_search(query) {
        let q = query ? Object.assign({}, query) : {};
        q[tab_id] = 'yes';
        delete q['notebooks'];
        delete q['error'];
        window.history.pushState(null, null, `?${$.param(q)}`);

        const newq = await search.execute(query);

        q = newq ? Object.assign({}, newq) : {};
        delete q['notebooks'];
        delete q['error'];

        q[tab_id] = 'yes';
        window.history.pushState(null, null, `?${$.param(q)}`);

        return newq;
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

            $('.nbsearch-all-check').removeClass(notebooks.length == 0 ? 'fa-check-square' : 'fa-square');
            $('.nbsearch-all-check').addClass(notebooks.length == 0 ? 'fa-square' : 'fa-check-square');
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

    function download_notebook(path, notebook, loading_indicator) {
        loading_indicator.show();
        console.log(log_prefix, 'Destination', path);
        prepare_notebook(path, notebook)
            .then(data => {
                const base_url = utils.get_body_data('baseUrl');
                const url = `${base_url}${base_url.endsWith('/') ? '' : '/'}notebooks${path}/${encodeURI(data.filename)}`
                console.log(log_prefix, 'Imported', data, url);
                window.open(url, '_blank');
                loading_indicator.hide();
            })
            .catch(err => {
                console.error(log_prefix, err);
                loading_indicator.hide();
                $('#nbsearch-error-import').show();
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

        const button = $('<button></button>')
            .addClass('btn btn-link nbsearch-import')
            .attr('title', 'Open Notebook');
        button.click(() => {
            download_notebook('/nbsearch-tmp', notebook, loading_indicator);
        });
        const download = $('<button></button>')
            .addClass('btn btn-link nbsearch-import')
            .attr('title', 'Download notebook to current folder')
            .append($('<i></i>').addClass('fa fa-cloud-download'));
        download.click(() => {
            const current_href = window.location.href.split(/[?#]/)[0];
            let path = current_href.substring(base_href.length);
            if (path.length > 0 && !path.startsWith('/')) {
                path = `/${path}`;
            }
            download_notebook(path, notebook, loading_indicator);
        });
        return $('<span></span>')
            .append(checkbox)
            .append(button.text(notebook['filename']))
            .append(download)
            .append(loading_indicator);
    }

    function render_notebook_results(data) {
        $('#nbsearch-loading').hide();
        const tbody = $('#nbsearch-result');
        tbody.empty();

        (data.notebooks || []).forEach(notebook => {
            const heading = $('<span></span>')
                .text(notebook['source__markdown__heading_count'] || '')
                .attr('title', notebook['source__markdown__heading'] || '');
            const operation_note = $('<span></span>')
                .text(_shorten(notebook['source__markdown__operation_note'] || ''))
                .attr('title', notebook['source__markdown__operation_note'] || '');
            const tr = $('<tr></tr>')
                .append($('<td></td>').append(create_link(notebook)))
                .append($('<td></td>').text(notebook['server'] || notebook['signature_server_url']))
                .append($('<td></td>').text(notebook['owner']))
                .append($('<td></td>').text(notebook['mtime']))
                .append($('<td></td>').text(notebook['lc_cell_meme__execution_end_time']))
                .append($('<td></td>').append(operation_note))
                .append($('<td></td>').append(heading));
            tbody.append(tr);
        });
        if (!data.error && (data.notebooks || []).length === 0) {
            const tr = $('<tr></tr>')
                .append($('<td></td>').attr('colspan', '7').text('No results'));
            tbody.append(tr);
        }
        if (data.error) {
            const tr = $('<tr></tr>')
                .append($('<td></td>')
                .attr('colspan', '7')
                .css('color', '#f00')
                .text(`${data.error.msg} (code=${data.error.code})`));
            tbody.append(tr);
        }
        $('.nbsearch-page-number').text(`${data.start}-${data.start + data.limit}`);
    }

    function render_error(err) {
        $('#nbsearch-loading').hide();
        $('#nbsearch-error-connect').show();
    }

    function _shorten(desc) {
        const LENGTH = 16;
        if (desc.length < LENGTH) {
            return desc;
        }
        return desc.substring(0, LENGTH) + '...';
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
            const baseq = search.get_notebook_query(
                Math.min(parseInt(last_query.start) - parseInt(last_query.limit), 0).toString(),
                last_query.limit,
                last_query.sort
            );
            run_search(baseq)
                .then(newq => {
                    console.log(log_prefix, 'SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        });
        const next_button = $('<button></button>')
            .addClass('btn btn-link btn-xs')
            .append($('<i></i>').addClass('fa fa-angle-right'));
        next_button.click(() => {
            console.log(log_prefix, 'Next', last_query);
            const baseq = search.get_notebook_query(
                (parseInt(last_query.start) + parseInt(last_query.limit)).toString(),
                last_query.limit,
                last_query.sort
            );
            run_search(baseq)
                .then(newq => {
                    console.log(log_prefix, 'SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
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
                    console.log(log_prefix, err);
                });
        });

        const page_number = $('<span></span>')
            .addClass('nbsearch-page-number');
        return $('<div></div>')
            .append(prev_button)
            .append(page_number)
            .append(next_button)
            .append(diff_button);
    }

    function create_query_ui(query) {
        const url = new URL(window.location);
        last_query = Object.assign({}, query);

        const headers = [['Path', 'filename'],
                         ['Server', 'signature_server_url'],
                         ['Owner', 'owner'],
                         ['Modified', 'mtime'],
                         ['Executed', 'lc_cell_meme__execution_end_time'],
                         ['Operation Note', 'source__markdown__operation_note'],
                         ['# of Headers', 'source__markdown__heading_count']];
        const header_elems = headers.map(cols => {
            const colname = cols[0];
            const colid = cols[1];
            const label = $('<span></span>')
                .addClass('nbsearch-column-order');
            const colbutton = $('<button></button>')
                .addClass('btn btn-link nbsearch-column-header')
                .prop('disabled', true)
                .text(colname)
                .append(label);
            const sort = url.searchParams.get('sort');
            if (sort == `${colid} asc`) {
                label.append($('<i></i>').addClass('fa fa-angle-up'));
            } else if (sort == `${colid} desc`) {
                label.append($('<i></i>').addClass('fa fa-angle-down'));
            }
            colbutton.click(() => {
                if (!last_query) {
                    return;
                }
                let sort = last_query.sort;
                if (sort == `${colid} desc`) {
                    sort = `${colid} asc`;
                } else {
                    sort = `${colid} desc`;
                }
                const baseq = search.get_notebook_query(
                    undefined, undefined, sort
                );
                run_search(baseq)
                    .then(newq => {
                        console.log(log_prefix, 'SUCCESS', newq);
                        last_query = newq;
                        $('.nbsearch-column-order').empty();
                        const sort_button = $('<i></i>');
                        if (last_query.sort == `${colid} desc`) {
                            label.append(sort_button.addClass('fa fa-angle-down'));
                        } else {
                            label.append(sort_button.addClass('fa fa-angle-up'));
                        }
                        diff_selected = {};
                    })
                    .catch(e => {
                        console.error(log_prefix, 'ERROR', e);
                    });
            });
            return $('<th></th>')
                .append(colbutton);
        });
        const all_check = $('<button></button>')
            .addClass('btn btn-link nbsearch-column-header')
            .prop('disabled', true)
            .append($('<i></i>')
                .addClass('nbsearch-all-check fa fa-square'));
        all_check.click(() => {
            const notebooks = Object.entries(diff_selected).filter(v => v[1] !== null).map(v => v[1]);
            const checkboxes = $('.nbsearch-diff')
            checkboxes.prop('checked', notebooks.length == 0);
            checkboxes.trigger('change');
        });
        header_elems[0].prepend(all_check);

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
            const baseq = search.get_notebook_query(
                last_query.start, last_query.limit, last_query.sort
            );
            run_search(baseq)
                .then(newq => {
                    $('.nbsearch-save-button').prop('disabled', false);
                    $('.nbsearch-column-header').prop('disabled', false);
                    console.log(log_prefix, 'SUCCESS', newq);
                    last_query = newq;
                    diff_selected = {};
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        });

        const toolbar = $('<div></div>')
            .addClass('row list_toolbar')
            .append($('<div></div>')
                .addClass('col-sm-12 no-padding nbsearch-search-panel')
                .append(search.create_notebook_query_ui(last_query))
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

        const tab_body = $('<div/>')
            .attr('id', tab_id)
            .addClass('tab-pane')
            .appendTo('.tab-content');

        var tab_link = $('<a>')
            .text(tab_text)
            .attr('href', '#' + tab_id)
            .attr('data-toggle', 'tab')
            .on('click', function (evt) {
                 const q = last_query ? Object.assign({}, last_query) : {};
                 q[tab_id] = 'yes';
                 window.history.pushState(null, null, `?${$.param(q)}`);
            });

        $('<li>')
            .append(tab_link)
            .appendTo('#tabs');

        // select tab if searchparams is set appropriately
        const url = new URL(window.location);

        const query = search.query_from_search_params(url.searchParams);
        tab_body.append($('<div></div>')
            .attr('id', 'nbsearch-query-panel')
            .append(create_query_ui(query)));
        if (url.searchParams.get(tab_id) == 'yes') {
            tab_link.click();
        }
    }

    function load_extension() {
        base_href = get_base_path();
        search.init(get_api_base_url(), 'notebook', {
            render_results: render_notebook_results,
            render_error: render_error,
            render_loading: function() {
                $('#nbsearch-loading').show();
                $('#nbsearch-error-connect').hide();
            },
        });

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
        load_ipython_extension : load_extension,
        load_jupyter_extension : load_extension
    };
});
