package com.ticketrush.bookingservice.config;

import com.ticketrush.bookingservice.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(HttpClientErrorException.Conflict.class)
    public ResponseEntity<ApiResponse<Void>> handleSeatConflict(HttpClientErrorException.Conflict ex) {
        String message = extractErrorMessage(ex.getResponseBodyAsString(),
                "Ghế này vừa có người đặt, vui lòng chọn ghế khác");
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(message));
    }

    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<ApiResponse<Void>> handleClientError(HttpClientErrorException ex) {
        String message = extractErrorMessage(ex.getResponseBodyAsString(), "Request failed");
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return ResponseEntity.status(status)
                .body(ApiResponse.error(message));
    }

    @ExceptionHandler(HttpServerErrorException.class)
    public ResponseEntity<ApiResponse<Void>> handleServerError(HttpServerErrorException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error("Event service is temporarily unavailable. Please try again."));
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<ApiResponse<Void>> handleConnectionError(ResourceAccessException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.error("Cannot connect to the event service. Please try again later."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred."));
    }

    private String extractErrorMessage(String body, String fallback) {
        if (body == null || body.isBlank()) {
            return fallback;
        }
        // Try to extract "message" field from JSON response
        try {
            int messageIndex = body.indexOf("\"message\"");
            if (messageIndex < 0) {
                messageIndex = body.indexOf("\"error\"");
            }
            if (messageIndex >= 0) {
                int colonIndex = body.indexOf(':', messageIndex);
                int startQuote = body.indexOf('"', colonIndex + 1);
                int endQuote = body.indexOf('"', startQuote + 1);
                if (startQuote >= 0 && endQuote > startQuote) {
                    return body.substring(startQuote + 1, endQuote);
                }
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }
}
