package com.ticketrush.bookingservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatPurchaseRequestDTO {
    private String holderId;
    private List<Long> seatIds;
}
