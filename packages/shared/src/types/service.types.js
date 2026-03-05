"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthStatus = exports.ServiceType = void 0;
var ServiceType;
(function (ServiceType) {
    ServiceType["API_NESTJS"] = "api_nestjs";
    ServiceType["API_LARAVEL"] = "api_laravel";
    ServiceType["WEB_NEXTJS"] = "web_nextjs";
})(ServiceType || (exports.ServiceType = ServiceType = {}));
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["UP"] = "up";
    HealthStatus["DOWN"] = "down";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNKNOWN"] = "unknown";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
//# sourceMappingURL=service.types.js.map