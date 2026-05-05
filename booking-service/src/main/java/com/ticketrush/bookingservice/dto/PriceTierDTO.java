package com.ticketrush.bookingservice.dto;

import lombok.Data;

@Data
public class PriceTierDTO {
    private Long id;
    private String name;
    private Double price;
}
