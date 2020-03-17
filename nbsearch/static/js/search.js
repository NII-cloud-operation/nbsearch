define([
    'jquery',
], function(
    $,
) {
    const log_prefix = '[nbsearch]';
    const config = { urlPrefix: '', elemPrefix: '' };

    function init(urlPrefix, elemPrefix, createLink) {
        config.urlPrefix = urlPrefix;
        config.elemPrefix = elemPrefix;
        config.createLink = createLink;
    }

    function query_from_search_params(search_params) {
        const nq = search_params.get('nq');
        if (nq) {
          return {nq: JSON.stringify(JSON.parse(nq))};
        }
        const q = search_params.get('q');
        const meme = search_params.get('meme');
        return q != null ? { q } : { meme };
    }

    function _get_target_query() {
        const ttype = $('#nbsearch-target-type').val();
        if (ttype == 'ALL') {
            const text = $('#nbsearch-target-text').val();
            if (!text) {
                return {};
            }
            return { text };
        }
        if ($('#nbsearch-target-related').is(':checked')) {
            return { history_related: ttype };
        }
        return { history_in: ttype };
    }

    function _create_target_query_ui(target) {
        return new Promise((resolve, reject) => {
            const target_type = $('<select></select>')
                .attr('id', 'nbsearch-target-type')
                .append($('<option></option>').attr('value', 'ALL').text('全体'));
            const target_type_c = $('<div></div>')
                .addClass('nbsearch-category-body')
                .append($('<span></span>').text('検索範囲:'))
                .append(target_type);
            const target_text = $('<input></input>')
                .attr('id', 'nbsearch-target-text')
                .attr('type', 'text');
            const target_history = $('<input></input>')
                .attr('id', 'nbsearch-target-related')
                .attr('type', 'checkbox');
            const target_related = $('<span></span>')
                .addClass('nbsearch-target-disabled')
                .append(target_history)
                .append($('<label></label>').text('範囲を広げて履歴検索'));
            const target_text_c = $('<div></div>')
                .addClass('nbsearch-category-body')
                .append($('<span></span>').text('文字列検索:'))
                .append(target_text)
                .append(target_related);

            const field_updater = () => {
                target_text.prop('disabled', target_type.val() != 'ALL');
                target_history.prop('disabled', target_type.val() == 'ALL');
                if (target_type.val() == 'ALL') {
                    target_related.addClass('nbsearch-target-disabled');
                } else {
                    target_related.removeClass('nbsearch-target-disabled');
                }
            };
            target_type.val('ALL');
            field_updater();
            target_type.change(field_updater);
            $.getJSON(`${config.urlPrefix}/v1/history`)
                .done(data => {
                    console.log(log_prefix, 'histories', data);
                    target_type.empty();
                    target_type.append($('<option></option>').attr('value', 'ALL').text('全体'));
                    data.histories.forEach(h => {
                        target_type.append($('<option></option>')
                            .attr('value', h.id)
                            .text(`${h.text} (${h.id}, ノートブック数:${h.notebooks})`));
                    });
                    if (target && target.history_in) {
                        target_type.val(target.history_in);
                        target_history.prop('checked', false);
                    } else if (target && target.history_related) {
                        target_type.val(target.history_related);
                        target_history.prop('checked', true);
                    } else if (target && target.text) {
                        target_type.val('ALL');
                        target_text.val(target.text);
                    }
                    field_updater();

                    resolve($('<div></div>')
                        .addClass('nbsearch-category-section')
                        .append($('<div></div>').addClass('nbsearch-category-header').text('検索対象:'))
                        .append(target_type_c)
                        .append(target_text_c));
                })
                .fail(err => {
                    console.error('Failed to retrieve histories');
                    reject(err);
                });
        });
    }

    function _create_notebook_field_query_ui(fieldname, displayname, name, value) {
        const fieldtype = $('<select></select>')
            .addClass(`nbsearch-notebook-${fieldname}-type`);
        [
            ['eq', `${displayname}が一致`],
            ['not', `${displayname}が一致しない`],
            ['in', `${displayname}に含む`],
            ['not_in', `${displayname}に含まない`],
        ].forEach(v => {
            fieldtype.append($('<option></option>').attr('value', v[0]).text(v[1]));
        });
        fieldtype.val(name);
        const fieldvalue = $('<input></input>')
            .attr('type', 'text')
            .addClass(`nbsearch-notebook-${fieldname}-value`);
        fieldvalue.val(value);
        return $('<div></div>')
            .addClass(`nbsearch-notebook-${fieldname}`)
            .addClass('nbsearch-category-body')
            .append($('<span></span>').text(displayname))
            .append(fieldtype)
            .append(fieldvalue);
    }

    function _create_notebook_mtime_query_ui(name, value) {
        const fieldname = 'mtime';
        const displayname = '更新時刻';
        const fieldtype = $('<select></select>')
            .addClass(`nbsearch-notebook-${fieldname}-type`);
        [
            ['gte', '以後に更新'],
            ['lte', '以前に更新'],
        ].forEach(v => {
            fieldtype.append($('<option></option>').attr('value', v[0]).text(v[1]));
        });
        fieldtype.val(name);
        const fieldvalue = $('<input></input>')
            .attr('type', 'text')
            .addClass(`nbsearch-notebook-${fieldname}-value`);
        fieldvalue.val(value);
        return $('<div></div>')
            .addClass(`nbsearch-notebook-${fieldname}`)
            .addClass('nbsearch-category-body')
            .append($('<span></span>').text(displayname))
            .append(fieldvalue)
            .append(fieldtype);
    }

    function _get_notebook_query() {
        const query = {};
        ['path', 'server', 'mtime'].forEach(fieldname => {
            const k = $(`.nbsearch-notebook-${fieldname}-type`).val();
            const value = $(`.nbsearch-notebook-${fieldname}-value`).val();
            if (!value) {
              return;
            }
            const o = {};
            o[k] = value;
            query[fieldname] = o;
        });
        return query;
    }

    function _create_notebook_query_ui(notebook) {
        const path = notebook.path || {};
        const server = notebook.server || {};
        const mtime = notebook.mtime || {};
        const pathKeys = ['eq', 'in', 'not', 'not_in'].filter(k => path[k]);
        const serverKeys = ['eq', 'in', 'not', 'not_in'].filter(k => server[k]);
        const mtimeKeys = ['lte', 'gte', 'lt', 'gt'].filter(k => mtime[k]);
        const pathKey = pathKeys.length == 0 ? undefined : pathKeys[0];
        const serverKey = serverKeys.length == 0 ? undefined : serverKeys[0];
        const mtimeKey = mtimeKeys.length == 0 ? undefined : mtimeKeys[0];
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append($('<div></div>').addClass('nbsearch-category-header').text('Notebook条件:'))
            .append(_create_notebook_field_query_ui('path', 'ファイルパス', pathKey, path[pathKey]))
            .append(_create_notebook_field_query_ui('server', 'サーバーURL', serverKey, server[serverKey]))
            .append(_create_notebook_mtime_query_ui(mtimeKey, mtime[mtimeKey]));
    }

    function _get_cell_field_query(container) {
        const r = {};
        container.find('.nbsearch-cell-field').toArray().forEach(field => {
            const k = $(field).find('.nbsearch-cell-field-type').val();
            const v = $(field).find('.nbsearch-cell-field-value').val();
            if ((k.startsWith('in_') || k.startsWith('not_in_')) && !v) {
                return;
            }
            r[k] = v;
        });
        return r;
    }

    function _create_cell_field(fieldname, value) {
        const fieldtype = $('<select></select>')
            .addClass('nbsearch-cell-field-type');
        [['meme', 'MEME完全一致'],
         ['prev_meme', '先行MEME完全一致'],
         ['next_meme', '後続MEME完全一致'],
         ['in_meme', 'MEMEに含む'],
         ['in_prev_meme', '先行MEMEに含む'],
         ['in_next_meme', '後続MEMEに含む'],
         ['in_code', 'Codeに含む'],
         ['in_markdown', 'Markdownに含む'],
         ['in_output', 'Outputに含む'],
         ['not_meme', 'MEME一致しない'],
         ['not_prev_meme', '先行MEME一致しない'],
         ['not_next_meme', '後続MEME一致しない'],
         ['not_in_meme', 'MEMEに含まない'],
         ['not_in_prev_meme', '先行MEMEに含まない'],
         ['not_in_next_meme', '後続MEMEに含まない'],
         ['not_in_code', 'Codeに含まない'],
         ['not_in_markdown', 'Markdownに含まない'],
         ['not_in_output', 'Outputに含まない']].forEach(v => {
            fieldtype.append($('<option></option>').attr('value', v[0]).text(v[1]));
        });
        fieldtype.val(fieldname);
        const fieldvalue = $('<input></input>')
            .attr('type', 'text')
            .addClass('nbsearch-cell-field-value');
        fieldvalue.val(value);
        const container = $('<span></span>');
        const remove_button = $('<button></button>')
            .addClass('btn btn-default')
            .append($('<i></i>').addClass('fa fa-times'));
        remove_button.click(() => {
            container.remove();
        });
        return container
            .addClass('nbsearch-cell-field')
            .append(fieldtype)
            .append(fieldvalue)
            .append(remove_button);
    }

    function _get_cell_query() {
        const r = [];
        $('.nbsearch-cell-container').toArray().forEach(container => {
            const q = _get_cell_field_query($(container));
            if (Object.keys(q).length == 0) {
                return;
            }
            r.push(q);
        });
        if (r.length == 0) {
            return {};
        }
        rc = {};
        rc[$('#nbsearch-cell-cond').val()] = r;
        return rc;
    }

    function _create_cell_element_query_ui(cell) {
        const container = $('<div></div>')
            .addClass('nbsearch-cell-container');
        const fields = $('<span></span>');
        const add_button = $('<button></button>')
            .addClass('btn btn-default')
            .append($('<i></i>').addClass('fa fa-plus'));
        Object.keys(cell).forEach((k, field_index) => {
            fields.append(_create_cell_field(k, cell[k]));
        });
        add_button.click(() => {
            fields.append(_create_cell_field('meme', ''))
        })
        const remove_button = $('<button></button>')
            .addClass('btn btn-default')
            .append($('<i></i>').addClass('fa fa-trash'));
        remove_button.click(() => {
            container.remove();
        });
        return container.append(fields).append(add_button).append(remove_button);
    }

    function _create_cell_query_ui(cell) {
        const cell_cond = $('<select></select>')
            .attr('id', 'nbsearch-cell-cond')
            .append($('<option></option>').attr('value', 'and').text('すべて'))
            .append($('<option></option>').attr('value', 'or').text('いずれか'));
        let conds = [];
        if (cell && cell.and) {
            cell_cond.val('and');
            conds = cell.and || [];
        } else if (cell) {
            cell_cond.val('or');
            conds = cell.or || [];
        }
        if (conds.length == 0) {
            conds.push({ in_code: '' });
        }
        const cell_cond_c = $('<div></div>')
            .addClass('nbsearch-category-body')
            .append($('<span></span>').text('以下の条件に合致するセル'))
            .append(cell_cond)
            .append($('<span></span>').text('を含む'));

        const cell_conds = $('<div></div>')
            .addClass('nbsearch-category-body');
        conds.forEach((c, index) => {
            cell_conds.append(_create_cell_element_query_ui(c, index));
        });
        const cell_add_button = $('<button></button>')
            .addClass('btn btn-default')
            .append($('<i></i>').addClass('fa fa-plus'))
            .append('セル条件を追加');
        cell_add_button.click(() => {
            const index = $('.nbsearch-cell-container').length;
            cell_conds.append(_create_cell_element_query_ui({ meme: '' }, index));
        });
        const cell_conds_add = $('<div></div>')
            .addClass('nbsearch-category-body')
            .append(cell_add_button);
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append($('<div></div>').addClass('nbsearch-category-header').text('Cell条件:'))
            .append(cell_cond_c)
            .append(cell_conds)
            .append(cell_conds_add);
    }

    function _create_project_query_ui(project) {
        const cell_cond = $('<select></select>')
            .attr('id', 'nbsearch-retrieve')
            .append($('<option></option>').attr('value', 'original').text('何もしない'))
            .append($('<option></option>').attr('value', 'common_meme').text('MEME共通セット'))
            .append($('<option></option>').attr('value', 'markdown_section').text('Markdownセルセット'));
        const retrieve = project.retrieve || 'original';
        cell_cond.val(retrieve);
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append($('<div></div>').addClass('nbsearch-category-header').text('検索結果の抽出:'))
            .append($('<div></div>').addClass('nbsearch-category-body').append(cell_cond));
    }

    function _get_project_query() {
        return {
          retrieve: $('#nbsearch-retrieve').val(),
        };
    }

    async function create_cell_query_ui(query) {
        let nq = {};
        if (query && !query.nq && query.q) {
            const q = query.q;
            nq = { target: { text: q } };
        } else if (query && !query.nq && query.meme) {
            const meme = query.meme;
            nq = { cell: { and: [{ meme }] } };
        } else if (query && query.nq) {
            nq = JSON.parse(query.nq);
        }

        return $('<div></div>')
            .append(await _create_target_query_ui(nq.target || {}))
            .append(_create_notebook_query_ui(nq.notebook || {}))
            .append(_create_cell_query_ui(nq.cell || {}))
            .append(_create_project_query_ui(nq.project || {}));
    }

    function get_cell_query(start, limit) {
        r = {
            nq: JSON.stringify({
                target: _get_target_query(),
                notebook: _get_notebook_query(),
                cell: _get_cell_query(),
                project: _get_project_query(),
            })
        };
        if (start !== undefined) {
            r.start = start;
        }
        if (limit !== undefined) {
            r.limit = limit;
        }
        return r;
    }

    function _createLink(notebook) {
        return $('<a></a>')
            .attr('href', `${config.urlPrefix}/v1/download/${notebook.id}`).text(notebook['path']);
    }

    function save(query, name, byget) {
        return new Promise((resolve, reject) => {
            $(`#${config.elemPrefix}loading`).show();
            $(`#${config.elemPrefix}error-connect`).hide();

            const newq = Object.assign({}, query);
            if (byget) {
                newq.action = 'save';
                newq.name = name;
            }
            var jqxhr = $.ajax({
                type: byget ? 'GET' : 'PUT',
                url: `${config.urlPrefix}/v1/history?${$.param(newq)}`,
                contentType: 'application/json',
                data: JSON.stringify({ name }),
            })
                .done(data => {
                    console.log(log_prefix, 'query', data);
                    $(`#${config.elemPrefix}loading`).hide();
                    resolve(data);
                })
                .fail(err => {
                    $(`#${config.elemPrefix}loading`).hide();
                    $(`#${config.elemPrefix}error-connect`).show();
                    reject(err);
                });
        });
    }

    function execute(query_) {
        const query = Object.assign({}, query_);
        console.log(log_prefix, 'QUERY', query);
        return new Promise((resolve, reject) => {
            $(`#${config.elemPrefix}loading`).show();
            $(`#${config.elemPrefix}error-connect`).hide();
            var jqxhr = $.getJSON(`${config.urlPrefix}/v1/search?${$.param(query)}`)
                .done(data => {
                    console.log(log_prefix, 'query', data.nq);
                    $(`#${config.elemPrefix}loading`).hide();
                    const tbody = $(`#${config.elemPrefix}result`);
                    tbody.empty();

                    const createLink = config.createLink || _createLink;
                    data.notebooks.forEach(notebook => {
                        const tr = $('<tr></tr>')
                            .append($('<td></td>').append(createLink(notebook)))
                            .append($('<td></td>').text(notebook['server']))
                            .append($('<td></td>').text(notebook['mtime']))
                            .append($('<td></td>').text(notebook['atime']))
                            .append($('<td></td>').text((notebook['cells'] || []).length));
                        tbody.append(tr);
                    });
                    $(`.${config.elemPrefix}page-number`).text(`${data.start}-${data.start + data.limit}`);
                    query.start = data.start.toString();
                    query.limit = data.limit.toString();
                    resolve(query);
                })
                .fail(err => {
                    $(`#${config.elemPrefix}loading`).hide();
                    $(`#${config.elemPrefix}error-connect`).show();
                    reject(err);
                });
        });
    }

    return {
        init,
        execute,
        save,
        create_cell_query_ui,
        get_cell_query,
        query_from_search_params
    };
});
