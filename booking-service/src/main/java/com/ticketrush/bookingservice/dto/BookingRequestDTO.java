package com.ticketrush.bookingservice.dto;

import lombok.Data;
import java.util.List;

@Data
public class BookingRequestDTO {
    private Long eventId;
    private List<Long> seatIds;
    private String holderId;
    private Integer holdMinutes;
}
