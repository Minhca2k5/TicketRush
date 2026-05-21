package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingAccessClient {

    private final RestTemplate restTemplate;

    @Value("${app.booking-service-url}")
    private String bookingServiceUrl;

    public boolean hasPaidOrderForEvent(String userId, Long eventId) {
        if (isBlank(userId) || eventId == null) {
            return false;
        }

        String encodedUserId = UriUtils.encodePathSegment(userId.trim(), StandardCharsets.UTF_8);
        String url = bookingServiceUrl + "/api/booking/internal/users/" + encodedUserId + "/events/" + eventId + "/paid";

        try {
            ResponseEntity<ApiResponse<Boolean>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    new ParameterizedTypeReference<ApiResponse<Boolean>>() {}
            );
            return response.getBody() != null && Boolean.TRUE.equals(response.getBody().getData());
        } catch (RestClientException exception) {
            return false;
        }
    }

    public Set<Long> getPaidEventIds(String userId) {
        if (isBlank(userId)) {
            return Set.of();
        }

        String encodedUserId = UriUtils.encodePathSegment(userId.trim(), StandardCharsets.UTF_8);
        String url = bookingServiceUrl + "/api/booking/internal/users/" + encodedUserId + "/paid-event-ids";

        try {
            ResponseEntity<ApiResponse<List<Long>>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    new ParameterizedTypeReference<ApiResponse<List<Long>>>() {}
            );
            List<Long> eventIds = response.getBody() == null ? List.of() : response.getBody().getData();
            if (eventIds == null) {
                return Set.of();
            }
            return eventIds.stream()
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toSet());
        } catch (RestClientException exception) {
            return Set.of();
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
