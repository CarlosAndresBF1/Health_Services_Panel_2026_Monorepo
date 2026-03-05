"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsEvent = void 0;
// WebSocket event names
var WsEvent;
(function (WsEvent) {
    WsEvent["HEALTH_UPDATE"] = "health:update";
    WsEvent["INCIDENT_NEW"] = "incident:new";
    WsEvent["INCIDENT_RESOLVED"] = "incident:resolved";
    WsEvent["SERVICE_UPDATE"] = "service:update";
})(WsEvent || (exports.WsEvent = WsEvent = {}));
//# sourceMappingURL=websocket.types.js.map