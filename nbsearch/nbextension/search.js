define([
    'jquery',
], function(
    $,
) {
    const log_prefix = '[nbsearch]';
    const config = { url_prefix: '' };
    let last_cell_queries = null;

    function init(url_prefix, target, renderers) {
        config.url_prefix = url_prefix;
        config.target = target;
        config.renderers = renderers;
    }

    function query_from_search_params(search_params) {
        const baseq = {};
        const start = search_params.get('start');
        const limit = search_params.get('limit');
        const sort = search_params.get('sort');
        if (start !== undefined && start !== null) {
            baseq.start = parseInt(start);
        }
        if (limit !== undefined && limit !== null) {
            baseq.limit = parseInt(limit);
        }
        if (sort !== undefined && sort !== null) {
            baseq.sort = sort;
        }
        const solrquery = search_params.get('solrquery');
        return Object.assign(baseq, { solrquery });
    }

    function _create_target_query_ui(target) {
        const target_text = $('<input></input>')
            .attr('id', 'nbsearch-target-text')
            .attr('size', '80')
            .attr('type', 'text');
        target_text.keydown((e) => {
            if (e.which !== 13) {
                return;
            }
            $('#nbsearch-perform-search').click();
        });
        const target_text_c = $('<div></div>')
            .addClass('nbsearch-category-body')
            .append($('<span></span>').text('Solr Query:'))
            .append(target_text)
        if (target.solrquery) {
            const params = new URLSearchParams(target.solrquery);
            target_text.val(params.get('q') || '');
        }
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append(target_text_c);
    }

    function _create_cell_field(fieldname, value, change_callback) {
        const fieldtype = $('<select></select>')
            .addClass('nbsearch-cell-field-type');
        [
          ['_text_', 'Full text search'],
          ['owner', 'Owner name'],
          ['filename', 'File name'],
          ['server', 'Server URL'],
          ['source', 'Text in cell'],
          ['outputs', 'Output of cell'],
          ['lc_cell_memes', 'MEME of cell'],
          ['lc_notebook_meme__current', 'MEME of notebook'],
          ['signature_notebook_path', 'File path'],
          ['source__code', 'Text in code cell'],
          ['source__markdown', 'Text in markdown cell'],
          ['source__markdown__operation_note', 'Text in Operation Note'],
          ['source__markdown__todo', '`TODO` in markdown cell'],
          ['source__markdown__heading', 'Header in markdown cell'],
          ['source__markdown__url', 'URL in markdown cell'],
          ['source__markdown__code', 'Code in markdown cell'],
          ['outputs__stdout', 'STDOUT of cell'],
          ['outputs__stderr', 'STDERR of cell'],
          ['outputs__result_plain', 'Result Text of cell'],
          ['outputs__result_html', 'Result HTML of cell'],
        ].forEach(v => {
            fieldtype.append($('<option></option>').attr('value', v[0]).text(v[1]));
        });
        fieldtype.val(fieldname);
        fieldtype.change(change_callback)
        const fieldvalue = $('<input></input>')
            .attr('type', 'text')
            .addClass('nbsearch-cell-field-value');
        fieldvalue.val(value);
        fieldvalue.change(change_callback)
        fieldvalue.keydown((e) => {
            if (e.which !== 13) {
                return;
            }
            $('#nbsearch-perform-search').click();
        });
        const container = $('<span></span>');
        return container
            .addClass('nbsearch-cell-field')
            .append(fieldtype)
            .append(fieldvalue);
    }

    function _create_cell_element_query_ui(fieldname, value, change_callback) {
        const container = $('<div></div>')
            .addClass('nbsearch-cell-container');
        const fields = $('<span></span>');
        fields.append(_create_cell_field(fieldname, value, change_callback));
        const remove_button = $('<button></button>')
            .addClass('btn btn-default btn-xs')
            .append($('<i></i>').addClass('fa fa-trash'));
        remove_button.click(() => {
            container.remove();
        });
        return container.append(fields).append(remove_button);
    }

    function _create_notebook_query_ui(cell, change_callback) {
        const cell_cond = $('<select></select>')
            .attr('id', 'nbsearch-cell-cond')
            .append($('<option></option>').attr('value', 'AND').text('All conditions'))
            .append($('<option></option>').attr('value', 'OR').text('Any of the conditions'));
        let conds = (cell.conds || []).map(element => element);
        if (cell && cell.q_op) {
            cell_cond.val(cell.q_op);
        }
        if (conds.length == 0) {
            conds.push({
                name: '_text_',
                value: '*',
            });
        }
        const cell_cond_c = $('<div></div>')
            .addClass('nbsearch-category-body')
            .append(cell_cond)
            .append($('<span></span>').text('are satisfied'));

        const cell_conds = $('<div></div>')
            .addClass('nbsearch-category-body');
        conds.forEach(field => {
            cell_conds.append(_create_cell_element_query_ui(field.name, field.value, change_callback));
        });
        const cell_add_button = $('<button></button>')
            .addClass('btn btn-default btn-xs')
            .append($('<i></i>').addClass('fa fa-plus'))
            .append('Add condition');
        cell_add_button.click(() => {
            cell_conds.append(_create_cell_element_query_ui('_text_', '*', change_callback));
        });
        const cell_conds_add = $('<div></div>')
            .addClass('nbsearch-category-body')
            .append(cell_add_button);
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append(cell_cond_c)
            .append(cell_conds)
            .append(cell_conds_add);
    }

    function _create_base_query_ui(query_editor, query) {
        const solr_query = _create_target_query_ui(query || {});

        const tabs = $('<div></div>').addClass('nbsearch-query-tabs');
        const solr_query_button = $('<a></a>').text('Solr Query');
        const query_editor_button = $('<a></a>').text('Search');
        const solr_query_tab = $('<div></div>').append(solr_query_button);
        const query_editor_tab = $('<div></div>').append(query_editor_button);
        tabs.append(query_editor_tab);
        tabs.append(solr_query_tab);
        tabs.append($('<div></div>').css('flex-grow', '1').addClass('nbsearch-query-tab-inactive'));
        if (query.solrquery) {
            solr_query_tab.addClass('nbsearch-query-tab-active');
            query_editor_tab.addClass('nbsearch-query-tab-inactive');
            solr_query.show();
            query_editor.hide();
        } else {
            solr_query_tab.addClass('nbsearch-query-tab-inactive');
            query_editor_tab.addClass('nbsearch-query-tab-active');
            solr_query.hide();
            query_editor.show();
        }

        solr_query_button.click(() => {
            solr_query.show();
            query_editor.hide();
            solr_query_tab.removeClass('nbsearch-query-tab-inactive').addClass('nbsearch-query-tab-active');
            query_editor_tab.removeClass('nbsearch-query-tab-active').addClass('nbsearch-query-tab-inactive');
        });
        query_editor_button.click(() => {
            solr_query.hide();
            query_editor.show();
            solr_query_tab.removeClass('nbsearch-query-tab-active').addClass('nbsearch-query-tab-inactive');
            query_editor_tab.removeClass('nbsearch-query-tab-inactive').addClass('nbsearch-query-tab-active');
        });

        const container = $('<div></div>');
        container.append(solr_query);
        container.append(query_editor);

        return $('<div></div>')
            .append(tabs)
            .append(container);
    }

    function create_notebook_query_ui(query) {
        const query_preview = $('<span></span>')
            .attr('id', 'nbsearch-query-preview');
        const query_editor = _create_notebook_query_ui(query || {}, () => {
            query = _get_cell_query();
            query_preview.text(query);
        });
        query_editor
            .append($('<div></div>')
                .attr('id', 'nbsearch-query-preview-container')
                .addClass('nbsearch-category-body')
                .append($('<span></span>').text('Solr Query:'))
                .append(query_preview)
                .hide());
        return _create_base_query_ui(query_editor, query)
    }

    function _get_cell_queries(search_context) {
        const queries = [];
        queries.push({
            name: 'Search by MEME',
            query_id: 'search-by-meme',
            query: function() {
                if (search_context.lc_cell_meme__current) {
                    return `cell_type:${search_context.cell_type} AND lc_cell_meme__current:${search_context.lc_cell_meme__current}`;
                } else if(search_context.lc_cell_meme__previous) {
                    return `lc_cell_meme__previous:${search_context.lc_cell_meme__previous}`;
                } else if(search_context.lc_cell_meme__next) {
                    return `lc_cell_meme__next:${search_context.lc_cell_meme__next}`;
                } else if(search_context.lc_cell_memes__previous__in_section) {
                    return `lc_cell_memes__previous__in_section:${search_context.lc_cell_memes__previous__in_section}`;
                } else if(search_context.lc_cell_memes__next__in_section) {
                    return `lc_cell_memes__next__in_section:${search_context.lc_cell_memes__next__in_section}`;
                } else if(search_context.lc_cell_memes__previous__in_notebook) {
                    return `lc_cell_memes__previous__in_notebook:${search_context.lc_cell_memes__previous__in_notebook}`;
                } else if(search_context.lc_cell_memes__next__in_notebook) {
                    return `lc_cell_memes__next__in_notebook:${search_context.lc_cell_memes__next__in_notebook}`;
                }
            },
        });
        queries.push({
            name: 'Search by content',
            query_id: 'search-by-content',
            query: function() {
                const source = _escape_solr(search_context.source.replaceAll('\n', ' '));
                return `cell_type:${search_context.cell_type} AND source__${search_context.cell_type}:${source}`;
            },
        });
        last_cell_queries = queries;
        return queries;
    }

    function _escape_solr(source) {
        const chars = ['\\', '+', '-', '&&', '||', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':'];
        let replaced = source;
        chars.forEach(function(char_) {
            const echar = '\\' + char_.split('').join('\\');
            replaced = replaced.replaceAll(char_, echar);
        })
        return replaced;
    }

    function create_cell_query_ui(search_context, query) {
        const query_preview = $('<span></span>')
            .attr('id', 'nbsearch-query-preview');
        const query_editor = $('<select></select>').attr('id', 'nbsearch-cell-query');
        _get_cell_queries(search_context).forEach(function(option) {
            query_editor.append($('<option></option>').attr('value', option.query_id).text(option.name));
        });
        query_editor.change(function() {
            query = _get_cell_query();
            query_preview.text(query);
        });
        query_editor_container = $('<div></div>')
            .append(query_editor)
            .append($('<div></div>')
                .attr('id', 'nbsearch-query-preview-container')
                .addClass('nbsearch-category-body')
                .append($('<span></span>').text('Solr Query:'))
                .append(query_preview)
                .hide());
        return _create_base_query_ui(query_editor_container, query)
    }

    function _get_notebook_query() {
        const cond = $('#nbsearch-cell-cond').val();
        const cond_elems = [];
        $('.nbsearch-cell-field').toArray().forEach(field => {
            const k = $(field).find('.nbsearch-cell-field-type').val();
            const v = $(field).find('.nbsearch-cell-field-value').val();
            cond_elems.push(`${k}:${v}`);
        });
        return cond_elems.join(` ${cond} `);
    }

    function _get_cell_query() {
        const query_id = $('#nbsearch-cell-query').val();
        const q = last_cell_queries.filter(query => query.query_id === query_id);
        return q[0].query();
    }

    function get_notebook_query(start, limit, sort) {
        let query = $('#nbsearch-target-text').val();
        if ($('#nbsearch-cell-cond').is(':visible')) {
            query = _get_notebook_query();
            $('#nbsearch-query-preview').text(query);
            $('#nbsearch-query-preview-container').show();
            $('#nbsearch-target-text').val(query);
        }
        r = {
            query,
        };
        if (start !== undefined) {
            r.start = start.toString();
        }
        if (limit !== undefined) {
            r.limit = limit.toString();
        }
        if (sort !== undefined) {
            r.sort = sort;
        }
        return r;
    }

    function get_cell_query(start, limit, sort) {
        let query = $('#nbsearch-target-text').val();
        if ($('#nbsearch-cell-query').is(':visible')) {
            query = _get_cell_query();
            $('#nbsearch-query-preview').text(query);
            $('#nbsearch-query-preview-container').show();
            $('#nbsearch-target-text').val(query);
        }
        r = {
            query,
            q_op: 'OR',
        };
        if (start !== undefined) {
            r.start = start.toString();
        }
        if (limit !== undefined) {
            r.limit = limit.toString();
        }
        if (sort !== undefined) {
            r.sort = sort;
        }
        return r;
    }

    function execute(query_) {
        const query = Object.assign({}, query_);
        return new Promise((resolve, reject) => {
            if (config.renderers && config.renderers.render_loading) {
                config.renderers.render_loading();
            }
            $.getJSON(`${config.url_prefix}/v1/${config.target}/search?${$.param(query)}`)
                .done(data => {
                    console.log(log_prefix, 'Solr Query', data.solrquery);
                    if (config.renderers && config.renderers.render_results) {
                        config.renderers.render_results(data);
                    }
                    resolve(data);
                })
                .fail(err => {
                    console.error(log_prefix, 'error', err);
                    if (config.renderers && config.renderers.render_error) {
                        config.renderers.render_error(err);
                    }
                    reject(err);
                });
        });
    }

    return {
        init,
        execute,
        create_notebook_query_ui,
        create_cell_query_ui,
        get_notebook_query,
        get_cell_query,
        query_from_search_params,
    };
});
