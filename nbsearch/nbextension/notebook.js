require.config({
    map: {
        '*': {
            "diff_match_patch": "nbextensions/multi_outputs/lib/diff_match_patch"
        },
    },
});

define([
    'jquery',
    'require',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events',
    'codemirror/lib/codemirror',
    'codemirror/addon/merge/merge',
    './search',
], function(
    $,
    require,
    Jupyter,
    utils,
    events,
    codemirror,
    merge,
    search,
) {
    "use strict";

    const mod_name = 'nbsearch';
    const log_prefix = '[' + mod_name + ']';
    var options = {};
    let last_query = {};
    let last_candidate_list = null;
    let last_selected = null;
    let render_cell_buttons = null;

    function get_api_base_url() {
        const base_url = utils.get_body_data('baseUrl');
        return `${base_url}${base_url.endsWith('/') ? '' : '/'}nbsearch`;
    }

    function init_events() {
        events.on('select.Cell', function (e, data) {
            if (last_selected && last_selected.cell_id === (data.cell || {}).cell_id) {
                return;
            }
            console.log('Data', data, last_selected);
            hide_result();
        });
    }

    async function run_search(query) {
        const q = await search.execute(query);
        delete q['cells'];
        delete q['error'];
        return q;
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
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        });

        const page_number = $('<span></span>')
            .addClass('nbsearch-page-number');
        return $('<div></div>')
            .append(prev_button)
            .append(page_number)
            .append(next_button);
    }

    function create_query_ui(search_context, query) {
        const url = new URL(window.location);
        last_query = Object.assign({}, query);

        const headers = [['Source', 'source'],
                         ['Path', 'notebook_filename'],
                         ['Server', 'notebook_server'],
                         ['Owner', 'notebook_owner'],
                         ['Executed/Modified', 'estimated_mtime']];
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
                const baseq = search.get_cell_query(
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
                    })
                    .catch(e => {
                        console.error(log_prefix, 'ERROR', e);
                    });
            });
            return $('<th></th>')
                .append(colbutton);
        });
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
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        });

        const toolbar = $('<div></div>')
            .addClass('row list_toolbar')
            .append($('<div></div>')
                .addClass('col-sm-12 no-padding nbsearch-search-panel')
                .append(search.create_cell_query_ui(search_context, last_query))
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

    function get_source(cell) {
        const cell_type = cell.cell_type;
        const source = cell[`source__${cell_type}`];
        return source || '';
    }

    function render_cell_results(data) {
        $('#nbsearch-loading').hide();
        const tbody = $('#nbsearch-result');
        tbody.empty();
        console.log(log_prefix, 'Loaded', data.cells);
        (data.cells || []).forEach(cell => {
            const tr_content = $('<tr></tr>')
                .append($('<td></td>')
                    .attr('colspan', '5')
                    .append($('<pre></pre>').text(get_source(cell)))
                    .append(render_cell_buttons(cell))
                )
                .hide();
            const tr_detail = $('<tr></tr>')
                .append($('<td></td>')
                    .append($('<span></span>').text(_shorten(get_source(cell))))
                    .append(render_cell_buttons(cell))
                )
                .append($('<td></td>').text(_shorten(cell['notebook_filename'] || '')))
                .append($('<td></td>').text(_shorten(cell['notebook_server'] || '')))
                .append($('<td></td>').text(_shorten(cell['notebook_owner'] || '')))
                .append($('<td></td>').text(cell['estimated_mtime']))
                .show();
            tr_content.click(function() {
                tr_content.hide();
                tr_detail.show();
            });
            tr_detail.click(function() {
                tr_detail.hide();
                tr_content.show();
            });
            tbody.append(tr_content);
            tbody.append(tr_detail);
        });
        if (!data.error && (data.cells || []).length === 0) {
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

    function show_diff_dialog(current, result) {
        const value = current;
        const orig = result;
        if(value === "" && orig === "") {
            return;
        }

        var dv;
        var content = $('<div/>').addClass('multi-outputs-diff');
        var searchbar = $('<div/>').addClass('multi-outputs-search-bar');
        $('<span/>').addClass('label').text('Search').appendTo(searchbar);
        var input = $('<input/>').attr('type', 'text').appendTo(searchbar);
        input.keydown(function(event, ui) {
            event.stopPropagation();
            return true;
        });
        input.change(function(event, ui) {
            var text = input.val();
            mark_text(dv.edit, text);
            mark_text(dv.right.orig, text);
        });
        $('<button></button>')
            .text('Replace')
            .click(function() {
                if (last_selected && last_selected.code_mirror) {
                    last_selected.code_mirror.setValue(result);
                }
                content.dialog("destroy");
            })
            .appendTo(searchbar);

        var dialogResized = function (event, ui) {
            content.css('width', '');
            var dialog = content.parent();
            var titlebar = dialog.find('.ui-dialog-titlebar');
            var height = dialog.height() - titlebar.outerHeight();
            content.css('height', height + 'px');
            var merge = content.find('.CodeMirror-merge');
            var mergeHeight = content.height() - searchbar.outerHeight();
            merge.css('height', mergeHeight + 'px');
            dv.edit.setSize(null, merge.height() + 'px');
            dv.right.orig.setSize(null, merge.height() + 'px');
            dv.right.forceUpdate();
        }

        content.dialog({
            open: function(event, ui) {
                dv = codemirror.MergeView(content.get(0), {
                    value: value,
                    orig: orig,
                    lineNumbers: true,
                    mode: "text/plain",
                    highlightDifferences: true,
                    revertButtons: false,
                    lineWrapping: true
                });
                searchbar.appendTo(content);
                dialogResized();
            },
            close: function(event, ui) {
                content.dialog("destroy");
            },
            resize: dialogResized,
            resizeStop: dialogResized,
            title: "Diff: Current <- Result",
            minWidth: 500,
            minHeight: 400,
            width: 500,
            height: 400,
        });
    }

    function hide_result() {
        if (!last_candidate_list) {
            return;
        }
        last_candidate_list.remove();
        last_candidate_list = null;
    }

    function get_default_query(search_context) {
        let content_query = '';
        if (search_context.lc_cell_meme__previous) {
            content_query = `AND lc_cell_meme__previous:${search_context.lc_cell_meme__previous}`;
        } else if (search_context.lc_cell_meme__current) {
            content_query = `AND lc_cell_meme__current:${search_context.lc_cell_meme__current}`;
        } else if (search_context.source) {
            const source = search_context.source.replaceAll('\n', ' ');
            content_query = `AND source__${search_context.cell_type}:${source}`;
        }
        return `cell_type:${search_context.cell_type} ${content_query}`;
    }

    function cell_append_search() {
        const cells = Jupyter.notebook.get_selected_cells();
        const target_cell = cells[0];
        if (!target_cell) {
            return;
        }
        const metadata = target_cell.metadata;
        last_selected = target_cell;
        hide_result();
        const search_context = {
            cell_type: target_cell.cell_type,
        };
        if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
            search_context.lc_cell_meme__previous = metadata.lc_cell_meme.current;
        }
        render_cell_buttons = function(cell) {
            const current = (last_selected && last_selected.code_mirror) ? last_selected.code_mirror.getValue() : '';
            const add_button = $('<button></button>')
                .append($('<i></i>').addClass('fa').addClass('fa-plus'))
                .click(function() {
                    const cellobj = Jupyter.notebook.insert_cell_below(cell.cell_type);
                    cellobj.set_text(get_source(cell));
                    if (cell.lc_cell_meme__current) {
                        cellobj.metadata = {
                            lc_cell_meme: {
                                current: cell.lc_cell_meme__current,
                            },
                        };
                    }
                    const cell_idx = Jupyter.notebook.get_cell_elements().index(cellobj.element);
                    Jupyter.notebook.select(cell_idx);
                    console.log(log_prefix, 'Added', Jupyter.notebook, cellobj, cell_idx);
                    return false;
                })
            return add_button;
        };
        last_candidate_list = $('<div></div>')
            .addClass('nbsearch-notebook-result-append')
            .append(create_query_ui(search_context));
        target_cell.element.append(last_candidate_list);
        setTimeout(function() {
            run_search({
                query: get_default_query(search_context),
            })
                .then(newq => {
                    $('.nbsearch-column-header').prop('disabled', false);
                    console.log(log_prefix, 'SUCCESS', newq);
                    last_query = newq;
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        }, 100);
    }

    function cell_search() {
        const cells = Jupyter.notebook.get_selected_cells();
        const target_cell = cells[0];
        if (!target_cell) {
            return;
        }
        if (target_cell.cell_type === 'markdown' && target_cell.rendered) {
            return;
        }
        const metadata = target_cell.metadata;
        last_selected = target_cell;
        hide_result();
        const search_context = {
            cell_type: target_cell.cell_type,
        };
        if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
            search_context.lc_cell_meme__current = metadata.lc_cell_meme.current;
        }
        if (target_cell.code_mirror) {
            search_context.source = target_cell.code_mirror.getValue() || '';
        }
        render_cell_buttons = function(cell) {
            const current = (last_selected && last_selected.code_mirror) ? last_selected.code_mirror.getValue() : '';
            const diff_button = $('<button></button>')
                .append($('<i></i>').addClass('fa').addClass('fa-fw').addClass('fa-exchange'))
                .click(function() {
                    show_diff_dialog(current, get_source(cell));
                    return false;
                })
            return diff_button;
        };
        last_candidate_list = $('<div></div>')
            .addClass('nbsearch-notebook-result-self')
            .append(create_query_ui(search_context));
        target_cell.element.append(last_candidate_list);
        setTimeout(function() {
            run_search({
                query: get_default_query(search_context),
                q_op: 'OR',
            })
                .then(newq => {
                    $('.nbsearch-column-header').prop('disabled', false);
                    console.log(log_prefix, 'SUCCESS', newq);
                    last_query = newq;
                })
                .catch(e => {
                    console.error(log_prefix, 'ERROR', e);
                });
        }, 100);
    }

    function register_toolbar_buttons() {
        const buttons = [
            Jupyter.keyboard_manager.actions.register(
                {
                    'help'   : 'Search cell using NBsearch',
                    'icon'   : 'fa-search',
                    'handler': cell_search,
                },
                'button-search',
                mod_name
            ),
            Jupyter.keyboard_manager.actions.register(
                {
                    'help'   : 'Search following cell using NBsearch',
                    'icon'   : 'fa-append-search',
                    'handler': cell_append_search,
                },
                'button-append-search',
                mod_name
            ),
        ];
        Jupyter.toolbar.add_buttons_group(buttons);
    }

    function load_extension() {
        $('<link>')
            .attr('rel', 'stylesheet')
            .attr('type', 'text/css')
            .attr('href', require.toUrl('./main.css'))
            .appendTo('head');
        register_toolbar_buttons();
        search.init(get_api_base_url(), 'cell', {
            render_results: render_cell_results,
            render_error: render_error,
            render_loading: function() {
                $('#nbsearch-loading').show();
                $('#nbsearch-error-connect').hide();
            },
        });

        /**
        * execute this extension on load
        */
        var on_notebook_loaded = function() {
            init_events();
        };

        Jupyter.notebook.config.loaded.then(function on_config_loaded() {
            $.extend(true, options, Jupyter.notebook.config.data[mod_name]);
        }, function on_config_load_error(reason) {
            console.warn(log_prefix, 'Using defaults after error loading config:', reason);
        }).then(function do_stuff_with_config() {
            events.on("notebook_loaded.Notebook", on_notebook_loaded);
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                on_notebook_loaded();
            }
        }).catch(function on_error(reason) {
            console.error(log_prefix, 'Error:', reason);
        });
    }

    return {
        load_ipython_extension : load_extension,
        load_jupyter_extension : load_extension
    };
});
