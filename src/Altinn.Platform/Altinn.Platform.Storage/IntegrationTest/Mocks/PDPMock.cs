using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Altinn.Authorization.ABAC.Xacml.JsonProfile;
using Altinn.Common.PEP.Interfaces;
using Newtonsoft.Json;

namespace Altinn.Platform.Storage.IntegrationTest.Mocks
{
    /// <summary>
    /// Mock of PDP that implements simplified GetDecisionForRequest method.
    /// </summary>
    public class PDPMock : IPDP
    {
        /// <summary>
        /// Validates an authorization request. UserId 1 or org will return a permit response.
        /// </summary>
        /// <param name="xacmlJsonRequest">The xacmlJsonRequest.</param>
        /// <returns>XacmlJsonResponse permit or deny.</returns>
        public Task<XacmlJsonResponse> GetDecisionForRequest(XacmlJsonRequestRoot xacmlJsonRequest)
        {
            string jsonResponse = string.Empty;

            if (xacmlJsonRequest.Request.AccessSubject[0].Attribute.Exists(a => (a.AttributeId == "urn:altinn:userid" && a.Value == "1")) ||
                xacmlJsonRequest.Request.AccessSubject[0].Attribute.Exists(a => a.AttributeId == "urn:altinn:org"))
            {
                jsonResponse = File.ReadAllText("data/response_permit.json");
            }
            else
            {
                jsonResponse = File.ReadAllText("data/response_deny.json");
            }

            XacmlJsonResponse response = JsonConvert.DeserializeObject<XacmlJsonResponse>(jsonResponse);

            return Task.FromResult(response);
        }

        public Task<bool> GetDecisionForUnvalidateRequest(XacmlJsonRequestRoot xacmlJsonRequest, ClaimsPrincipal user)
        {
            return Task.FromResult(true);
        }
    }
}