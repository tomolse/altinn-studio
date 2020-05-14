/*
  This test script can only be run with virtual users and iterations count and not based on duration.
  Create and archive instances of RF-0002 with attachments, where the distribution of attachments is based on 
  parameter attachmentdistribution among small, medium and large attachment.
  example: k6 run -i 20 -u 10 /src/tests/app/rf0002withattachment.js 
  -e env=test -e org=ttd -e level2app=rf-0002 -e subskey=*** -e attachmentdistribution="60;30;10"
*/

import { check } from "k6";
import {addErrorCount, printResponseToConsole} from "../../errorcounter.js";
import * as appInstances from "../../api/app/instances.js"
import * as appData from "../../api/app/data.js"
import * as appProcess from "../../api/app/process.js"
import * as platformInstances from "../../api/storage/instances.js"
import * as apps from "../../api/storage/applications.js"
import {deleteSblInstance} from "../../api/storage/messageboxinstances.js"
import * as setUpData from "../../setup.js";

const instanceFormDataXml = open("../../data/rf-0002.xml");
const appOwner = __ENV.org;
const level2App = __ENV.level2app;
var attachmentDistribution = __ENV.attachmentdistribution;
const smallAttachment = open("../../data/50kb.txt");
const mediumAttachment = open("../../data/1mb.txt");
const largeAttachment = open("../../data/99mb.txt");
const users = JSON.parse(open("../../data/users.json"));
const usersCount = users.length;

export const options = {
    thresholds:{
        "errors": ["count<1"]
    }
};

//setup functions creates an array of attachment data based on the distribution percentage and total iteration count
export function setup(){
    var data = {};
    var totalIterations = (options.iterations) ? options.iterations : 1;
    var maxVus = (options.vus) ? options.vus : 1;
    data.maxIter = Math.floor(totalIterations / maxVus); //maximum iteration per vu
    attachmentDistribution = (attachmentDistribution) ? attachmentDistribution : "";
    let attachmentTypes = setUpData.buildAttachmentTypeArray(attachmentDistribution, totalIterations);
    data.attachmentTypes = attachmentTypes;
    return data;
}

//Tests for App API: RF-0002
export default function(data) {
    var userNumber = (__VU - 1) % usersCount;
    var maxIter = data.maxIter
    var attachmentTypes = (data.attachmentTypes[0]) ? data.attachmentTypes : ['s'];    

    //Find a unique number for the type of attachment to upload
    var uniqueNum = ((__VU * maxIter) - (maxIter) + (__ITER));
    uniqueNum = (uniqueNum > attachmentTypes.length) ? Math.floor((uniqueNum % attachmentTypes.length)) : uniqueNum;

    //Find a username and password from the users file
    try {
        var userSSN = users[userNumber].username;
        var userPwd = users[userNumber].password;    
    } catch (error) {
        printResponseToConsole("Testdata missing", false, null);
    };

    var aspxauthCookie = setUpData.authenticateUser(userSSN, userPwd);
    const runtimeToken = setUpData.getAltinnStudioRuntimeToken(aspxauthCookie);
    setUpData.clearCookies();
    var attachmentDataType = apps.getAppByName(runtimeToken, appOwner, level2App);
    attachmentDataType = apps.findAttachmentDataType(attachmentDataType.body);   
    const partyId = users[userNumber].partyid;  
    var instanceId = "";    
    var dataId = "";  

    //Test to create an instance with App api and validate the response
    instanceId = appInstances.postInstance(runtimeToken, partyId);
    var success = check(instanceId, {
        "E2E App POST Create Instance status is 201:": (r) => r.status === 201        
      });  
    addErrorCount(success);
    printResponseToConsole("E2E App POST Create Instance:", success, instanceId);
    
    dataId = appData.findDataId(instanceId.body);
    instanceId = platformInstances.findInstanceId(instanceId.body);  
    
    //Test to edit a form data in an instance with App APi and validate the response
    var res = appData.putDataById(runtimeToken, partyId, instanceId, dataId, "default", instanceFormDataXml);
    success = check(res, {
        "E2E PUT Edit Data by Id status is 201:": (r) => r.status === 201        
    });  
    addErrorCount(success);
    printResponseToConsole("E2E PUT Edit Data by Id:", success, res);

    //dynamically assign attachments - based on the value from the array holding the attachment type
    var attachment = (attachmentTypes[uniqueNum] === 's') ? smallAttachment : ((attachmentTypes[uniqueNum] === 'm') ? mediumAttachment : largeAttachment);
    
    //upload a upload attachment to an instance with App API
    res = appData.postData(runtimeToken, partyId, instanceId, attachmentDataType, attachment);
    success = check(res, {
        "E2E POST upload attachment Data status is 201:": (r) => r.status === 201        
    });
    addErrorCount(success);    
    printResponseToConsole("E2E POST upload attachment Data status:", success, res);

    //Test to get validate instance and verify that validation of instance is ok
    res = appInstances.getValidateInstance(runtimeToken, partyId, instanceId);
    success = check(res, {
        "E2E App GET Validate Instance validation OK:": (r) => r.body && (JSON.parse(r.body)).length === 0     
    });  
    addErrorCount(success);    
    printResponseToConsole("E2E App GET Validate Instance is not OK:", success, res);

    //Test to get next process of an app instance again and verify response code  to be 200
    res = appProcess.getNextProcess(runtimeToken, partyId, instanceId);
    success = check(res, {
        "E2E App GET Next process element id:": (r) => r.status === 200
    });
    addErrorCount(success);   
    printResponseToConsole("Unable to get next element id:", success, res);
    var nextElement = (JSON.parse(res.body))[0];

    //Test to move the process of an app instance to the next process element and verify response code to be 200
    res = appProcess.putNextProcess(runtimeToken, partyId, instanceId, nextElement);
    success = check(res, {
        "E2E App PUT Move process to Next element status is 200:": (r) => r.status === 200      
    });  
    addErrorCount(success);
    printResponseToConsole("E2E App PUT Move process to Next element:", success, res);

    //Test to call get instance details and verify the presence of archived date
    res = appInstances.getInstanceById(runtimeToken, partyId, instanceId);    
    success = check(res, {
        "E2E App Instance is archived:": (r) => (JSON.parse(r.body)).status.archived != null
    });
    addErrorCount(success); 
    printResponseToConsole("E2E App Instance is not archived:", success, res);

    deleteSblInstance(runtimeToken, partyId, instanceId, "true");    
};