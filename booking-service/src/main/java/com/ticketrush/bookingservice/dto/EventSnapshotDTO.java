package com.ticketrush.bookingservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class EventSnapshotDTO {
    private Long id;
    private String name;
    private String location;
    private LocalDateTime startTime;
    private VenueSnapshotDTO venue;

    public String displayName() {
        return name == null || name.isBlank() ? "your event" : name;
    }

    public String displayLocation() {
        if (location != null && !location.isBlank()) {
            return location;
        }
        if (venue != null) {
            if (venue.getName() != null && !venue.getName().isBlank()) {
                return venue.getName();
            }
            if (venue.getAddress() != null && !venue.getAddress().isBlank()) {
                return venue.getAddress();
            }
        }
        return "the venue";
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class VenueSnapshotDTO {
        private String name;
        private String address;
    }
}
