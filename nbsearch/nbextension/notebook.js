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
    let last_search_context = null;
    let current_miraged_cell_id = null;

    function get_api_base_url() {
        const base_url = utils.get_body_data('baseUrl');
        return `${base_url}${base_url.endsWith('/') ? '' : '/'}nbsearch`;
    }

    function init_events() {
        events.on('select.Cell', function (e, data) {
            update_search_context();
            update_mirage();
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
            const baseq = search.get_cell_query(
                (parseInt(last_query.start) + parseInt(last_query.limit)).toString(),
                last_query.limit,
                last_query.sort
            );
            run_search(baseq)
                .then(newq => {
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
                $('#nbsearch_error').empty();
                run_search(baseq)
                    .then(newq => {
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
                        $('#nbsearch_error').text('Network Error');
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
            .attr('id', 'nbsearch-perform-search')
            .addClass('btn btn-default btn-xs')
            .append($('<i></i>').addClass('fa fa-search'))
            .append('Search');
        search_button.click(() => search_last_query());
        const search_for = create_search_for_selector();
        const toolbar = $('<div></div>')
            .addClass('row list_toolbar')
            .append($('<div></div>')
                .addClass('col-sm-12 no-padding nbsearch-search-panel')
                .append(search_for)
                .append(search.create_cell_query_ui(search_context, last_query))
                .append(search_button)
                .append(loading_indicator));
        const error = $('<div></div>')
            .addClass('nbsearch-error-container')
            .attr('id', 'nbsearch_error');
        return [
            error,
            toolbar,
            $('<div></div>')
                .addClass('nbsearch-search-cell-result')
                .append(create_page_button())
                .append(list)
                .append(create_page_button())
        ];
    }

    function search_last_query() {
        const baseq = search.get_cell_query(
            last_query.start, last_query.limit, last_query.sort
        );
        $('#nbsearch_error').empty();
        run_search(baseq)
            .then(newq => {
                $('.nbsearch-save-button').prop('disabled', false);
                $('.nbsearch-column-header').prop('disabled', false);
                last_query = newq;
            })
            .catch(e => {
                console.error(log_prefix, 'ERROR', e);
                $('#nbsearch_error').text('Network Error');
            });
    }

    function create_search_for_selector() {
        const container = $('<div></div>');
        const selector = $('<select></select>');
        selector
            .attr('id', 'nbsearch-search-for')
            .append($('<option></option>').attr('value', 'current').text('Current cell'))
            .append($('<option></option>').attr('value', 'next').text('Subsequent cell'))
            .append($('<option></option>').attr('value', 'previous').text('Preceding cell'))
            .append($('<option></option>').attr('value', 'next-section').text('Subsequent cells(in section)'))
            .append($('<option></option>').attr('value', 'previous-section').text('Preceding cells(in section)'))
            .append($('<option></option>').attr('value', 'next-notebook').text('Subsequent cells(in notebook)'))
            .append($('<option></option>').attr('value', 'previous-notebook').text('Preceding cells(in notebook)'))
            .change(() => {
                update_search_context();
                update_mirage();
                search_last_query();
            });
        return container
            .addClass('nbsearch-search-for')
            .append($('<div></div>').text('Search for:').addClass('nbsearch-search-for-label'))
            .append(selector);
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
        (data.cells || []).forEach(cell => {
            const button = $('<button></button>')
                .addClass('btn btn-link')
                .text(_shorten(get_source(cell)));
            const tr_detail = $('<tr></tr>')
                .append($('<td></td>')
                    .append(button)
                )
                .append($('<td></td>').text(_shorten(cell['notebook_filename'] || '')))
                .append($('<td></td>').text(_shorten(cell['notebook_server'] || '')))
                .append($('<td></td>').text(_shorten(cell['notebook_owner'] || '')))
                .append($('<td></td>').text(cell['estimated_mtime']))
                .show();
            button.click(function() {
                if (cell.id === current_miraged_cell_id && $('.nbsearch-mirage').is(':visible')) {
                    $('.nbsearch-mirage').hide();
                } else {
                    current_miraged_cell_id = cell.id;
                    $('.nbsearch-mirage-buttons')
                        .empty()
                        .append(render_cell_buttons(cell));
                    $('.nbsearch-mirage-cell-content').text(get_source(cell));
                    $('.nbsearch-mirage').show();
                }
            });
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
        let pageNums = '';
        if (data.numFound) {
            pageNums = `${data.start}-${Math.min(data.start + data.limit, data.numFound)} / ${data.numFound}`;
        }
        $('.nbsearch-page-number').text(pageNums);
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

    function set_value_to_cell(cell, result) {
        if (!cell) {
            return;
        }
        if (!cell.code_mirror) {
            console.warn('code_mirror not found', cell)
            return;
        }
        if (!cell.element.find('.CodeMirror').is(':visible')) {
            // Ensure edit mode
            $(cell.element).dblclick();
        }
        cell.code_mirror.setValue(result);
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
        if (search_context.lc_cell_meme__previous) {
           return `lc_cell_meme__previous:${search_context.lc_cell_meme__previous}`;
        } else if (search_context.lc_cell_meme__next) {
            return `lc_cell_meme__next:${search_context.lc_cell_meme__next}`;
        } else if (search_context.lc_cell_meme__current) {
            return `cell_type:${search_context.cell_type} AND lc_cell_meme__current:${search_context.lc_cell_meme__current}`;
        } else if (search_context.source) {
            const source = search_context.source.replaceAll('\n', ' ');
            return `cell_type:${search_context.cell_type} AND source__${search_context.cell_type}:${source}`;
        }
        throw new Error('Unexpected search context');
    }

    function update_search_context() {
        const cells = Jupyter.notebook.get_selected_cells();
        const target_cell = cells[0];
        if (!target_cell) {
            return;
        }
        const search_for = $('#nbsearch-search-for').val() || 'current';
        const metadata = target_cell.metadata;
        last_search_context.cell_type = target_cell.cell_type;
        if (target_cell.code_mirror) {
            last_search_context.source = target_cell.code_mirror.getValue() || '';
        }
        last_search_context.lc_cell_meme__current = null;
        last_search_context.lc_cell_meme__next = null;
        last_search_context.lc_cell_meme__previous = null;
        last_search_context.lc_cell_memes__next__in_section = null;
        last_search_context.lc_cell_memes__previous__in_section = null;
        last_search_context.lc_cell_memes__next__in_notebook = null;
        last_search_context.lc_cell_memes__previous__in_notebook = null;
        if (search_for === 'current') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_meme__current = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'next') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_meme__previous = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'previous') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_meme__next = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'next-section') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_memes__previous__in_section = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'previous-section') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_memes__next__in_section = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'next-notebook') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_memes__previous__in_notebook = metadata.lc_cell_meme.current;
            }
        } else if (search_for === 'previous-notebook') {
            if (metadata && metadata.lc_cell_meme && metadata.lc_cell_meme.current) {
                last_search_context.lc_cell_memes__next__in_notebook = metadata.lc_cell_meme.current;
            }
        }
    }

    function update_mirage() {
        const cells = Jupyter.notebook.get_selected_cells();
        const target_cell = cells[0];
        $('.nbsearch-mirage').remove();
        if (!target_cell) {
            return;
        }
        const search_for = $('#nbsearch-search-for').val() || 'current';
        const element = target_cell.element;
        const mirage = create_mirage_cell();
        const buttons = $('<div></div>')
            .addClass('nbsearch-mirage-buttons');
        if (search_for === 'current') {
            element.append($('<div></div>')
                .addClass('nbsearch-mirage')
                .addClass('nbsearch-mirage-overlay')
                .append(buttons)
                .append(mirage)
                .hide());
        } else if (search_for.match(/^next/)) {
            element.after($('<div></div>')
                .addClass('nbsearch-mirage')
                .addClass('nbsearch-mirage-container')
                .append(buttons)
                .append(mirage)
                .hide());
        } else if (search_for.match(/^previous/)) {
            element.before($('<div></div>')
                .addClass('nbsearch-mirage')
                .addClass('nbsearch-mirage-container')
                .append(buttons)
                .append(mirage)
                .hide());
        }
        $('.nbsearch-mirage').mouseup((e) => e.stopPropagation());
    }

    function create_mirage_cell() {
        const pre = $('<pre></pre>')
            .addClass('nbsearch-mirage-cell-content');
        return $('<div></div>')
            .addClass('nbsearch-mirage-cell')
            .append(pre);
    }

    function render_cell_buttons(cell) {
        const search_for = $('#nbsearch-search-for').val();
        if (search_for === 'current') {
            const cells = Jupyter.notebook.get_selected_cells();
            const target_cell = cells[0];
            if (!target_cell) {
                return null;
            }
            const diff_button = $('<button></button>')
                .append($('<i></i>').addClass('fa').addClass('fa-fw').addClass('fa-exchange'))
                .click(() => {
                    const current = target_cell.code_mirror ? target_cell.code_mirror.getValue() : '';
                    show_diff_dialog(current, get_source(cell));
                    return false;
                })
            const replace_button = $('<button></button>')
                .text('Replace')
                .click(() => {
                    set_value_to_cell(target_cell, get_source(cell));
                    update_search_context();
                    update_mirage();
                });
            return $('<div></div>').append(diff_button).append(replace_button);
        } else {
            const add_button = $('<button></button>')
                .append($('<i></i>').addClass('fa').addClass('fa-plus'))
                .click(() => {
                    const cellobj = search_for === 'next' ?
                        Jupyter.notebook.insert_cell_below(cell.cell_type) :
                        Jupyter.notebook.insert_cell_above(cell.cell_type);
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
                    cellobj.element[0].scrollIntoView(search_for !== 'next');
                    update_search_context();
                    update_mirage();
                    return false;
                })
            return add_button;
        }
    }

    function cell_search() {
        const visible = $('#button-nbsearch').attr('aria-pressed') == 'false';
        if (!visible) {
            hide_result();
            return;
        }
        last_search_context = {};
        update_search_context();
        update_mirage();
        last_candidate_list = $('<div></div>')
            .addClass('nbsearch-notebook-result')
            .keydown((e) => e.stopPropagation());
        create_query_ui(last_search_context).forEach((c) => last_candidate_list.append(c));
        $('#site').append(last_candidate_list);
        const maintoolbar = $('#maintoolbar');
        const sidebar_top = maintoolbar.position().top + maintoolbar.outerHeight(true);
        last_candidate_list
            .css('top', sidebar_top)
            .css('width', '30vw')
            .resizable({
                handles: 'w',
            })
            .children('.ui-resizable-w').toggleClass('ui-icon ui-icon-grip-dotted-vertical', true);
        setTimeout(function() {
            run_search({
                query: get_default_query(last_search_context),
                q_op: 'OR',
            })
                .then(newq => {
                    $('.nbsearch-column-header').prop('disabled', false);
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
                'button-nbsearch',
                mod_name
            ),
        ];
        Jupyter.toolbar.add_buttons_group(buttons)
            .find('.btn')
            .attr('id', 'button-nbsearch')
            .attr('data-toggle', 'button')
            .attr('aria-pressed', 'false');
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
