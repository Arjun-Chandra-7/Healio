'use strict';
const handler=require('../server.js').createHandler();
module.exports=(request,response)=>{request.url='/api/prescription';return handler(request,response);};
