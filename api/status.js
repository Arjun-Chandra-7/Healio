'use strict';
const handler=require('../server.js').createHandler();
module.exports=(request,response)=>{request.url='/api/status';return handler(request,response);};
