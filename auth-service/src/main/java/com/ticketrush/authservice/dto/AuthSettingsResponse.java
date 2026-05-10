package com.ticketrush.authservice.dto;

public class AuthSettingsResponse {

    private final String serviceName;
    private final long jwtExpirationMs;
    private final String seededAdminUsername;
    private final String seededAdminEmail;
    private final String passwordEncoding;

    public AuthSettingsResponse(
            String serviceName,
            long jwtExpirationMs,
            String seededAdminUsername,
            String seededAdminEmail,
            String passwordEncoding
    ) {
        this.serviceName = serviceName;
        this.jwtExpirationMs = jwtExpirationMs;
        this.seededAdminUsername = seededAdminUsername;
        this.seededAdminEmail = seededAdminEmail;
        this.passwordEncoding = passwordEncoding;
    }

    public String getServiceName() {
        return serviceName;
    }

    public long getJwtExpirationMs() {
        return jwtExpirationMs;
    }

    public String getSeededAdminUsername() {
        return seededAdminUsername;
    }

    public String getSeededAdminEmail() {
        return seededAdminEmail;
    }

    public String getPasswordEncoding() {
        return passwordEncoding;
    }
}
