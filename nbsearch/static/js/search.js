define([
    'jquery',
], function(
    $,
) {
    const config = { urlPrefix: '', elemPrefix: '' };

    function init(urlPrefix, elemPrefix, createLink) {
        config.urlPrefix = urlPrefix;
        config.elemPrefix = elemPrefix;
        config.createLink = createLink;
    }

    function _createLink(notebook) {
        return $('<a></a>')
            .attr('href', `${config.urlPrefix}/v1/download/${notebook.id}`).text(notebook['path']);
    }

    function execute(query) {
        $(`#${config.elemPrefix}loading`).show();
        $(`#${config.elemPrefix}error-connect`).hide();
        var jqxhr = $.getJSON(`${config.urlPrefix}/v1/search?${$.param(query)}`)
            .done(data => {
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
            })
            .fail(() => {
                $(`#${config.elemPrefix}loading`).hide();
                $(`#${config.elemPrefix}error-connect`).show();
            });
    }

    return { init, execute };
});
