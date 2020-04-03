define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'require',
    'bidi/bidi',
    './search',
], function(
    $,
    Jupyter,
    utils,
    require,
    bidi,
    search,
) {
    "use strict";

    const mod_name = 'nbsearch';
    const log_prefix = '[' + mod_name + ']';
    const tab_id = 'nbsearch';

    const isRTL = bidi.isMirroringEnabled();

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
        window.history.pushState(null, null, `?${$.param(q)}`);

        const newq = await search.execute(query);

        q = newq ? Object.assign({}, newq) : {};
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
            .append(button.text(notebook['path']))
            .append(download)
            .append(loading_indicator);
    }

    function open_save_dialog() {
        console.log('show usage', self.db);

        let dlg = null;
        const text = $('<input></input>')
            .attr('type', 'text')
            .attr('size', '40');
        const body = $('<div></div>')
            .append($('<span></span>')
                 .append($('<span></span>').text('履歴名:'))
                 .append(text));
        const buttons = {
            'Close': {
                class: 'btn-default',
                click: () => {
                    dlg.modal('hide');
                }
            },
            'Save': {
                class: 'btn-primary',
                click: () => {
                    search.save(last_query, text.val(), true)
                        .then(result => {
                            console.log(log_prefix, 'SUCCESS', result);
                            dlg.modal('hide');
                        })
                        .catch(e => {
                            console.error(log_prefix, 'ERROR', e);
                            dlg.modal('hide');
                        });
                }
            }
        };

        dlg = Jupyter.dialog.modal({
            title: '検索結果の保存',
            body: body,
            buttons: buttons,
        });
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
            const baseq = search.get_cell_query(
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
            const baseq = search.get_cell_query(
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

        const save_button = $('<button></button>')
            .addClass('btn btn-default btn-xs nbsearch-save-button')
            .prop('disabled', true)
            .append($('<i></i>').addClass('fa fa-save'))
            .append('Save');
        save_button.click(() => {
            open_save_dialog();
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

    function refresh_histories(data) {
        const tbody = $('#nbsearch-histories');
        tbody.empty();
        data.histories.forEach(history => {
            let name = history['name'];
            if (name.length > 40) {
                name = name.substring(0, 38) + '...';
            }
            const fill_search_button = $('<button></button>')
                .addClass('btn btn-xs')
                .append($('<i></i>').addClass('fa fa-search'));
            const plus_search_button = $('<button></button>')
                .addClass('btn btn-xs')
                .append($('<i></i>').addClass('fa fa-search-plus'));
            fill_search_button.click(() => {
                if (!history.nq) {
                    console.error(log_prefix, 'No queries for: ', history.id);
                    return;
                }
                const query = { nq: JSON.stringify(history.nq) };
                create_query_ui(query)
                    .then(ui => {
                        $('#nbsearch-query-panel').empty();
                        $('#nbsearch-query-panel').append(ui);
                        const baseq = search.get_cell_query();
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
                    })
                    .catch(err => {
                        console.error(log_prefix, 'Failed to create search UI', err);
                    });
            });
            plus_search_button.click(() => {
                $('#nbsearch-target-type').val(history.id);
            });
            const remove_button = $('<button></button>')
                .addClass('btn btn-xs')
                .append($('<i></i>').addClass('fa fa-trash'));
            remove_button.click(() => {
                search.remove(history.id, true)
                    .then(result => {
                        search.get_histories()
                            .then(data => {
                                refresh_histories(data);
                            })
                            .catch(err => {
                                console.error(log_prefix, 'Failed to load history', err);
                            });
                    })
                    .catch(err => {
                        console.error(log_prefix, 'Failed to remove history', err);
                    });
            });
            const tr = $('<tr></tr>')
                .append($('<td></td>')
                    .text(`${name} (${history['id']})`)
                    .append(fill_search_button)
                    .append(plus_search_button)) //.append(createLink(notebook)))
                .append($('<td></td>').text(history['created'] ? new Date(history['created'] * 1000).toISOString() : ''))
                .append($('<td></td>').text(history['elapsed'] ? `${parseInt(history['elapsed'])}sec` : ''))
                .append($('<td></td>').text(history['notebooks']))
                .append($('<td></td>').append(remove_button));
            tbody.append(tr);
        });
    }

    function create_history_ui() {
        const headers = [['Name', 'name'], ['Created', 'created'],
                         ['Elapsed', 'elapsed'], ['# of Notebooks', null],
                         ['', null]];
        const header_elems = headers.map(cols => {
            const colname = cols[0];
            const colid = cols[1];
            const label = $('<span></span>')
                .addClass('nbsearch-history-column-order')
                .text(colname);
            return $('<th></th>')
                .append(label);
        });
        const tbody = $('<tbody></tbody>')
            .attr('id', 'nbsearch-histories')
            .append($('<tr></tr>')
                .append($('<td></td>')
                    .attr('colspan', headers.length)
                    .append('No history')));
        const histories = $('<table></table>')
            .addClass('table')
            .append($('<thead></thead>')
                .append(header_elems))
            .append(tbody);
        const title = $('<a></a>')
            .attr('data-toggle', 'collapse')
            .attr('data-target', '#nbsearch-history')
            .attr('href', '#')
            .attr('aria-expanded', 'false')
            .text('検索履歴');
        const heading = $('<div></div>')
            .addClass('panel-heading')
            .append(title);
        const body = $('<div></div>')
            .addClass('panel-body')
            .append(histories);
        const container = $('<div></div>')
            .addClass('collapse')
            .attr('id', 'nbsearch-history')
            .attr('aria-expanded', 'false')
            .append(body);
        title.each(function(index, el) {
            var $link = $(el);
            var $icon = $('<i />')
                .addClass('fa fa-caret-down');
            $link.append($icon);
            $link.down = true;
            $link.click(function () {
                if ($link.down) {
                    $link.down = false;
                    $icon.animate({ borderSpacing: 90 }, {
                        step: function(now,fx) {
                            isRTL ? $icon.css('transform','rotate(' + now + 'deg)') : $icon.css('transform','rotate(-' + now + 'deg)');
                        }
                    }, 250);
                } else {
                    $link.down = true;
                    // See comment above.
                    $icon.animate({ borderSpacing: 0 }, {
                        step: function(now,fx) {
                            isRTL ? $icon.css('transform','rotate(' + now + 'deg)') : $icon.css('transform','rotate(-' + now + 'deg)');
                        }
                    }, 250);
                }
            });
        });

        search.get_histories()
            .then(data => {
                refresh_histories(data);
            })
            .catch(err => {
                console.error(log_prefix, 'Failed to load history', err);
            });

        return $('<div></div>')
            .addClass('panel panel-default')
            .append(heading)
            .append(container);
    }

    async function create_query_ui(query) {
        const url = new URL(window.location);
        last_query = Object.assign({}, query);

        const headers = [['Path', 'path'], ['Server', 'server'],
                         ['MTime', 'mtime'], ['ATime', 'atime'],
                         ['# of Cells', null]];
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
            if (sort == `${colid}-asc`) {
                label.append($('<i></i>').addClass('fa fa-angle-up'));
            } else if (sort == `${colid}-desc`) {
                label.append($('<i></i>').addClass('fa fa-angle-down'));
            }
            colbutton.click(() => {
                if (!last_query) {
                    return;
                }
                $('.nbsearch-column-order').empty();
                let sort = last_query.sort;
                if (sort == `${colid}-asc`) {
                    sort = `${colid}-desc`;
                    label.append($('<i></i>').addClass('fa fa-angle-down'));
                } else {
                    sort = `${colid}-asc`;
                    label.append($('<i></i>').addClass('fa fa-angle-up'));
                }
                const baseq = search.get_cell_query(
                    undefined, undefined, sort
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
            const baseq = search.get_cell_query(
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
                .append(await search.create_cell_query_ui(last_query))
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
        tab_body.append(create_history_ui());
        tab_body.append($('<div></div>')
            .attr('id', 'nbsearch-query-panel')
            .append(await create_query_ui(query)));
        if (url.searchParams.get(tab_id) == 'yes') {
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
