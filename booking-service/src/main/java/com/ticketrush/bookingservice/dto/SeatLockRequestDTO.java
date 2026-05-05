package com.ticketrush.bookingservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatLockRequestDTO {
    private String holderId;
    private Integer holdMinutes;
}
