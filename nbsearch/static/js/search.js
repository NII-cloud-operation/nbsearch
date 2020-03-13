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
            return { text: $('#nbsearch-target-text').val() };
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
                    if (target.history_in) {
                        target_type.val(target.history_in);
                        target_history.prop('checked', false);
                    } else if (target.history_related) {
                        target_type.val(target.history_related);
                        target_history.prop('checked', true);
                    } else if (target.text) {
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

    function _create_notebook_query_ui(notebook) {
        const dummy = $('<div></div>')
            .addClass('nbsearch-category-body')
            .addClass('nbsearch-notebook-disabled')
            .text('No item');
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append($('<div></div>').addClass('nbsearch-category-header').text('Notebook条件:'))
            .append(dummy);
    }

    function _get_cell_field_query(index) {
        const field_index = $(`#nbsearch-cell-${index} .nbsearch-cell-field`).length;
        const r = {};
        for (let i = 0; i < field_index; i ++) {
            const k = $(`#nbsearch-cell-${index} .nbsearch-cell-field-${i} .nbsearch-cell-field-type`).val();
            const v = $(`#nbsearch-cell-${index} .nbsearch-cell-field-${i} .nbsearch-cell-field-value`).val();
            r[k] = v;
        }
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
         ['in_output', 'Outputに含む']].forEach(v => {
            fieldtype.append($('<option></option>').attr('value', v[0]).text(v[1]));
        });
        fieldtype.val(fieldname);
        const fieldvalue = $('<input></input>')
            .attr('type', 'text')
            .addClass('nbsearch-cell-field-value');
        fieldvalue.val(value);
        return $('<span></span>')
            .addClass('nbsearch-cell-field')
            .append(fieldtype)
            .append(fieldvalue);
    }

    function _get_cell_query() {
        const cell_index = $('.nbsearch-cell-container').length;
        const r = [];
        for (let i = 0; i < cell_index; i ++) {
            r.push(_get_cell_field_query(i));
        }
        rc = {};
        rc[$('#nbsearch-cell-cond').val()] = r;
        return rc;
    }

    function _create_cell_element_query_ui(cell, index) {
        const container = $('<div></div>')
            .attr('id', `nbsearch-cell-${index}`)
            .addClass('nbsearch-cell-container');
        const fields = $('<span></span>');
        const add_button = $('<button></button>')
            .addClass('btn btn-default')
            .append($('<i></i>').addClass('fa fa-plus'));
        Object.keys(cell).forEach((k, field_index) => {
            fields.append(_create_cell_field(k, cell[k])
                .addClass(`nbsearch-cell-field-${field_index}`));
        });
        add_button.click(() => {
            const field_index = $(`#nbsearch-cell-${index} .nbsearch-cell-field`).length;
            fields.append(_create_cell_field('meme', '')
                .addClass(`nbsearch-cell-field-${field_index}`))
        })
        return container.append(fields).append(add_button);
    }

    function _create_cell_query_ui(cell) {
        const cell_cond = $('<select></select>')
            .attr('id', 'nbsearch-cell-cond')
            .append($('<option></option>').attr('value', 'and').text('すべて'))
            .append($('<option></option>').attr('value', 'or').text('いずれか'));
        let conds = null;
        if (cell.and) {
            cell_cond.val('and');
            conds = cell.and || [];
        } else {
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
        const dummy = $('<div></div>')
            .addClass('nbsearch-category-body')
            .addClass('nbsearch-notebook-disabled')
            .text('No item');
        return $('<div></div>')
            .addClass('nbsearch-category-section')
            .append($('<div></div>').addClass('nbsearch-category-header').text('検索結果の抽出:'))
            .append(dummy);
    }

    async function create_cell_query_ui(query) {
        let nq = {};
        if (!query.nq && query.q) {
            const q = query.q;
            nq = { target: { text: q } };
        } else if (!query.nq && query.meme) {
            const meme = query.meme;
            nq = { cell: { and: [{ meme }] } };
        } else if (query.nq) {
            nq = JSON.parse(query.nq);
        }

        return $('<div></div>')
            .append(await _create_target_query_ui(nq.target))
            .append(_create_notebook_query_ui(nq.notebook))
            .append(_create_cell_query_ui(nq.cell))
            .append(_create_project_query_ui(nq.project));
    }

    function get_cell_query(start, limit) {
        r = {
            nq: JSON.stringify({
                target: _get_target_query(),
                cell: _get_cell_query(),
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

    function save(query, name) {
      $(`#${config.elemPrefix}loading`).show();
      $(`#${config.elemPrefix}error-connect`).hide();
      var jqxhr = $.ajax({
          type: 'PUT',
          url: `${config.urlPrefix}/v1/history?${$.param(query)}`,
          contentType: 'application/json',
          data: JSON.stringify({ name }),
      })
          .done(data => {
              console.log(log_prefix, 'query', data);
              $(`#${config.elemPrefix}loading`).hide();
          })
          .fail(() => {
              $(`#${config.elemPrefix}loading`).hide();
              $(`#${config.elemPrefix}error-connect`).show();
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
                            .append($('<td></td>').text(notebook['cells'].length));
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
