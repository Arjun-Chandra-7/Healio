'use strict';
const handler=require('../server.js').createHandler();
module.exports=(request,response)=>{request.url='/api/chat';return handler(request,response);};
