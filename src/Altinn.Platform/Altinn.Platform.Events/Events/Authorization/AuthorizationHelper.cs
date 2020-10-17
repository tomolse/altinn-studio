using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Altinn.Authorization.ABAC.Xacml.JsonProfile;
using Altinn.Common.PEP.Constants;
using Altinn.Common.PEP.Helpers;
using Altinn.Common.PEP.Interfaces;
using Altinn.Platform.Events.Models;
using Microsoft.Extensions.Logging;

namespace Altinn.Platform.Events.Authorization
{
    /// <summary>
    /// Authorization Helper for 
    /// </summary>
    public class AuthorizationHelper
    {
        private readonly IPDP _pdp;
 
        /// <summary>
        /// Initializes a new instance of the <see cref="AuthorizationHelper"/> class.
        /// </summary>
        /// <param name="pdp">The policy decision point</param>
        /// <param name="logger">The logger to use by the class.</param>
        public AuthorizationHelper(IPDP pdp)
        {
            _pdp = pdp;
         }

        /// <summary>
        /// Authorizes and filters events based on authorization
        /// </summary>
        /// <param name="consumer">The vent consumer</param>
        /// <param name="cloudEvents">The list of events</param>
        /// <returns></returns>
        public async Task<List<CloudEvent>> AuthorizeEvents(ClaimsPrincipal consumer, List<CloudEvent> cloudEvents)
        {
            XacmlJsonRequestRoot xacmlJsonRequest = CloudEventXacmlMapper.CreateMultiDecisionRequest(consumer, cloudEvents);
            XacmlJsonResponse response = await _pdp.GetDecisionForRequest(xacmlJsonRequest);
            List<CloudEvent> authorizedEventsList = new List<CloudEvent>();

            foreach (XacmlJsonResult result in response.Response)
            {
                if (DecisionHelper.ValidateDecisionResult(result, consumer))
                {
                    string eventId = string.Empty;
                    string actiontype = string.Empty;

                    // Loop through all attributes in Category from the response
                    foreach (XacmlJsonCategory category in result.Category)
                    {
                        var attributes = category.Attribute;

                        foreach (var attribute in attributes)
                        {
                            if (attribute.AttributeId.Equals(AltinnXacmlUrns.EventId))
                            {
                                eventId = attribute.Value;
                            }
                        }
                    }

                    // Find the instance that has been validated to add it to the list of authorized instances.
                    CloudEvent authorizedEvent = cloudEvents.First(i => i.Id == eventId);

                    // Checks if the instance has already been authorized
                    if (!authorizedEventsList.Any(i => i.Id.Equals(authorizedEvent.Id))) 
                    {
                        authorizedEventsList.Add(authorizedEvent);
                    }
                }
            }

            return authorizedEventsList;
        }
    }
}
