var http = require('http');
var urlParser = require('url');

var converters = {
    'sns2slack': function(data, headers) {
        return {
            url: 'https://hooks.slack.com/services/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',
            data: {
                'text': '' + data['Subject'] + '\n\n' + data['Message']
            }
        };
    }
};

function handleResponse(response) {
    console.log('STATUS: ' + response.statusCode);
    response.setEncoding('utf8');
    response.on('data', function(chunk) {
        console.log('BODY: ' + chunk);
    });
}

function handleError(error) {

}

function handleRequest(request, response) {
    var urlData = urlParser.parse(request.url);
    var converterId = urlData.pathname.substr(1);
    var convert = converters[converterId];
    if (convert) {
        var contentType = request.headers['content-type'];
        if (contentType == 'application/json') {

            var data = JSON.parse(request.read());

            var target = convert(data, request.headers);

            var targetRequestOptions = urlParser.parse(target.url);
            targetRequestOptions.method = target.method || 'POST';
            targetRequestOptions.headers = target.headers;

            var targetRequest = http.request(targetRequestOptions, handleResponse);
            targetRequest.on('error', handleError);
            targetRequest.write(
                typeof target.data == 'string' ? target.data : JSON.stringify(target.data)
            );
            targetRequest.end();

        }else {
            response.statusCode = 400;
        }
    }else {
        response.statusCode = 404;
    }
    response.end();
}

http.createServer(handleRequest).listen(80);

console.log('Server running at port 80.');
