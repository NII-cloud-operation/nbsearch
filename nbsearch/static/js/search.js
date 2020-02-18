define([
    'jquery',
], function(
    $,
) {
    const config = { urlPrefix: '', elemPrefix: '' };

    function init(urlPrefix, elemPrefix) {
        config.urlPrefix = urlPrefix;
        config.elemPrefix = elemPrefix;
    }

    function execute(query) {
        $(`#${config.elemPrefix}loading`).show();
        $(`#${config.elemPrefix}error-connect`).hide();
        var jqxhr = $.getJSON(`${config.urlPrefix}/v1/search?${$.param(query)}`)
            .done(data => {
                $(`#${config.elemPrefix}loading`).hide();
                const tbody = $(`#${config.elemPrefix}result`);
                tbody.empty();
                data.notebooks.forEach(notebook => {
                    const link = $('<a></a>')
                        .attr('href', `${config.urlPrefix}/v1/download/${notebook.id}`).text(notebook['path']);
                    const tr = $('<tr></tr>')
                        .append($('<td></td>').append(link))
                        .append($('<td></td>').text(notebook['server']))
                        .append($('<td></td>').text(notebook['mtime']))
                        .append($('<td></td>').text(notebook['atime']))
                        .append($('<td></td>').text(notebook['cells'].length));
                    tbody.append(tr);
                });
                query.start = data.start.toString();
                query.limit = data.limit.toString();
            })
            .fail(() => {
                $(`#${config.elemPrefix}loading`).hide();
                $(`#${config.elemPrefix}error-connect`).show();
            });
    }

    return { init, execute };
});
