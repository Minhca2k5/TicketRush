package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatCreationRequest {
    private Long eventId;
    private List<SeatBatchDTO> batches;
}
