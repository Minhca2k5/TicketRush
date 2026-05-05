package com.ticketrush.bookingservice.service;

import com.ticketrush.bookingservice.dto.*;
import com.ticketrush.bookingservice.entity.Order;
import com.ticketrush.bookingservice.entity.Ticket;
import com.ticketrush.bookingservice.repository.OrderRepository;
import com.ticketrush.bookingservice.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;
    private final RestTemplate restTemplate;

    @Value("${app.event-service-url}")
    private String eventServiceUrl;

    public SeatDTO lockSeat(Long eventId, Long seatId, String holderId, Integer holdMinutes) {
        String url = eventServiceUrl + "/api/events/" + eventId + "/seats/" + seatId + "/lock";
        SeatLockRequestDTO request = new SeatLockRequestDTO(holderId, holdMinutes);
        
        ResponseEntity<ApiResponse<SeatDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<ApiResponse<SeatDTO>>() {}
        );
        
        if (response.getBody() == null || !"SUCCESS".equals(response.getBody().getStatus())) {
            throw new RuntimeException("Failed to lock seat in event-service");
        }
        return response.getBody().getData();
    }

    public SeatDTO releaseSeat(Long eventId, Long seatId, String holderId) {
        String url = eventServiceUrl + "/api/events/" + eventId + "/seats/" + seatId + "/release";
        SeatReleaseRequestDTO request = new SeatReleaseRequestDTO(holderId);
        
        ResponseEntity<ApiResponse<SeatDTO>> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<ApiResponse<SeatDTO>>() {}
        );

        if (response.getBody() == null || !"SUCCESS".equals(response.getBody().getStatus())) {
            throw new RuntimeException("Failed to release seat in event-service");
        }
        return response.getBody().getData();
    }

    @Transactional
    public OrderDTO checkout(CheckoutRequestDTO request) {
        String url = eventServiceUrl + "/api/events/" + request.getEventId() + "/seats/purchase";
        SeatPurchaseRequestDTO purchaseRequest = new SeatPurchaseRequestDTO(request.getHolderId(), request.getSeatIds());
        
        ResponseEntity<ApiResponse<List<SeatDTO>>> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(purchaseRequest),
                new ParameterizedTypeReference<ApiResponse<List<SeatDTO>>>() {}
        );

        if (response.getBody() == null || !"SUCCESS".equals(response.getBody().getStatus())) {
            throw new RuntimeException("Failed to purchase seats in event-service");
        }

        List<SeatDTO> purchasedSeats = response.getBody().getData();
        
        BigDecimal totalPrice = purchasedSeats.stream()
                .filter(seat -> seat.getPriceTier() != null && seat.getPriceTier().getPrice() != null)
                .map(seat -> BigDecimal.valueOf(seat.getPriceTier().getPrice()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Order order = new Order();
        order.setUserId(request.getHolderId());
        order.setTotalPrice(totalPrice);
        order.setStatus("PAID");
        order = orderRepository.save(order);

        List<TicketDTO> ticketDTOs = new ArrayList<>();
        for (SeatDTO seat : purchasedSeats) {
            Ticket ticket = new Ticket();
            ticket.setOrder(order);
            ticket.setSeatId(seat.getId());
            ticket.setQrCodeToken(UUID.randomUUID().toString());
            ticket = ticketRepository.save(ticket);
            
            TicketDTO dto = new TicketDTO();
            dto.setId(ticket.getId());
            dto.setSeatId(ticket.getSeatId());
            dto.setQrCodeToken(ticket.getQrCodeToken());
            ticketDTOs.add(dto);
        }

        OrderDTO orderDTO = new OrderDTO();
        orderDTO.setId(order.getId());
        orderDTO.setUserId(order.getUserId());
        orderDTO.setTotalPrice(order.getTotalPrice());
        orderDTO.setStatus(order.getStatus());
        orderDTO.setCreatedAt(order.getCreatedAt());
        orderDTO.setTickets(ticketDTOs);
        
        return orderDTO;
    }

    public List<OrderDTO> getUserOrders(String userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream().map(order -> {
            OrderDTO dto = new OrderDTO();
            dto.setId(order.getId());
            dto.setUserId(order.getUserId());
            dto.setTotalPrice(order.getTotalPrice());
            dto.setStatus(order.getStatus());
            dto.setCreatedAt(order.getCreatedAt());
            
            List<TicketDTO> ticketDTOs = ticketRepository.findByOrderId(order.getId()).stream()
                .map(ticket -> {
                    TicketDTO tDto = new TicketDTO();
                    tDto.setId(ticket.getId());
                    tDto.setSeatId(ticket.getSeatId());
                    tDto.setQrCodeToken(ticket.getQrCodeToken());
                    return tDto;
                }).collect(Collectors.toList());
                
            dto.setTickets(ticketDTOs);
            return dto;
        }).collect(Collectors.toList());
    }
}
