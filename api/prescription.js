'use strict';
const handler=require('../lib/ai.js').createHandler();
module.exports=(request,response)=>{request.url='/api/prescription';return handler(request,response);};
