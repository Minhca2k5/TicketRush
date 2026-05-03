package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ZoneSeatMapDTO {
    private VenueZoneDTO zone;
    private EventPriceTierDTO priceTier;
    private List<SeatDTO> seats;
}
