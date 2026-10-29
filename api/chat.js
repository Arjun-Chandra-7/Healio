'use strict';
const handler=require('../lib/ai.js').createHandler();
module.exports=(request,response)=>{request.url='/api/chat';return handler(request,response);};
