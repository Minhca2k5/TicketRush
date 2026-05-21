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
import org.springframework.data.domain.Sort;
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
    private final BookingEmailService bookingEmailService;
    private final NotificationService notificationService;
    private final CouponService couponService;

    @Value("${app.event-service-url}")
    private String eventServiceUrl;

    private static final int MAX_LOCK_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 200;

    public SeatDTO lockSeat(Long eventId, Long seatId, String holderId, Integer holdMinutes) {
        String url = eventServiceUrl + "/api/events/" + eventId + "/seats/" + seatId + "/lock";
        SeatLockRequestDTO request = new SeatLockRequestDTO(holderId, holdMinutes);

        RuntimeException lastException = null;
        for (int attempt = 1; attempt <= MAX_LOCK_RETRIES; attempt++) {
            try {
                ResponseEntity<ApiResponse<SeatDTO>> response = restTemplate.exchange(
                        url,
                        HttpMethod.POST,
                        new HttpEntity<>(request),
                        new ParameterizedTypeReference<ApiResponse<SeatDTO>>() {}
                );

                if (response.getBody() == null || !"SUCCESS".equalsIgnoreCase(response.getBody().getStatus())) {
                    throw new RuntimeException("Failed to lock seat in event-service");
                }
                return response.getBody().getData();
            } catch (org.springframework.web.client.HttpClientErrorException.Conflict ex) {
                // Seat conflict — no point retrying
                throw ex;
            } catch (org.springframework.web.client.HttpClientErrorException ex) {
                throw ex;
            } catch (org.springframework.web.client.ResourceAccessException ex) {
                lastException = new RuntimeException("Event service is temporarily unavailable", ex);
                if (attempt < MAX_LOCK_RETRIES) {
                    try { Thread.sleep(RETRY_DELAY_MS * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            } catch (RuntimeException ex) {
                lastException = ex;
                if (attempt < MAX_LOCK_RETRIES) {
                    try { Thread.sleep(RETRY_DELAY_MS * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }
        throw lastException != null ? lastException : new RuntimeException("Failed to lock seat after retries");
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

        if (response.getBody() == null || !"SUCCESS".equalsIgnoreCase(response.getBody().getStatus())) {
            throw new RuntimeException("Failed to release seat in event-service");
        }
        SeatDTO releasedSeat = response.getBody().getData();
        notificationService.createSeatReleasedNotification(holderId, eventId, releasedSeat);
        return releasedSeat;
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

        if (response.getBody() == null || !"SUCCESS".equalsIgnoreCase(response.getBody().getStatus())) {
            throw new RuntimeException("Failed to purchase seats in event-service");
        }

        List<SeatDTO> purchasedSeats = response.getBody().getData();
        
        BigDecimal originalPrice = purchasedSeats.stream()
                .filter(seat -> seat.getPriceTier() != null && seat.getPriceTier().getPrice() != null)
                .map(seat -> BigDecimal.valueOf(seat.getPriceTier().getPrice()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPrice = originalPrice;
        BigDecimal discountAmount = BigDecimal.ZERO;
        String appliedCouponCode = null;

        if (request.getCouponCode() != null && !request.getCouponCode().trim().isEmpty()) {
            com.ticketrush.bookingservice.dto.CouponValidationResultDTO validationResult = couponService.applyCoupon(request.getCouponCode(), originalPrice);
            if (validationResult.isValid()) {
                discountAmount = validationResult.getDiscountAmount();
                totalPrice = validationResult.getFinalPrice();
                appliedCouponCode = request.getCouponCode().trim().toUpperCase();
            } else {
                throw new RuntimeException("Áp dụng mã giảm giá thất bại: " + validationResult.getMessage());
            }
        }

        Order order = new Order();
        order.setUserId(request.getHolderId());
        order.setEventId(request.getEventId());
        order.setTotalPrice(totalPrice);
        order.setOriginalPrice(originalPrice);
        order.setDiscountAmount(discountAmount);
        order.setCouponCode(appliedCouponCode);
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

        notificationService.createTicketPurchasedNotification(order, ticketDTOs.size(), totalPrice);

        OrderDTO orderDTO = new OrderDTO();
        orderDTO.setId(order.getId());
        orderDTO.setUserId(order.getUserId());
        orderDTO.setEventId(order.getEventId());
        orderDTO.setTotalPrice(order.getTotalPrice());
        orderDTO.setOriginalPrice(order.getOriginalPrice());
        orderDTO.setDiscountAmount(order.getDiscountAmount());
        orderDTO.setCouponCode(order.getCouponCode());
        orderDTO.setStatus(order.getStatus());
        orderDTO.setCreatedAt(order.getCreatedAt());
        orderDTO.setTickets(ticketDTOs);

        EventDTO event = fetchEventDetails(request.getEventId());
        bookingEmailService.sendBookingConfirmation(
                request.getCustomerEmail(),
                request.getCustomerName(),
                orderDTO,
                event
        );
        
        return orderDTO;
    }

    public List<OrderDTO> getUserOrders(String userId) {
        List<Order> orders = orderRepository.findByUserId(userId);
        return orders.stream().map(this::mapOrderToDTO).collect(Collectors.toList());
    }

    public boolean userHasPaidOrderForEvent(String userId, Long eventId) {
        if (userId == null || userId.isBlank() || eventId == null) {
            return false;
        }
        return orderRepository.existsByUserIdAndEventIdAndStatusIgnoreCase(userId.trim(), eventId, "PAID");
    }

    public List<Long> getPaidEventIds(String userId) {
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        return orderRepository.findByUserIdAndStatusIgnoreCase(userId.trim(), "PAID").stream()
                .map(Order::getEventId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    public List<OrderDTO> getAllOrders() {
        return orderRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::mapOrderToDTO)
                .collect(Collectors.toList());
    }

    private OrderDTO mapOrderToDTO(Order order) {
        OrderDTO dto = new OrderDTO();
        dto.setId(order.getId());
        dto.setUserId(order.getUserId());
        dto.setEventId(order.getEventId());
        dto.setTotalPrice(order.getTotalPrice());
        dto.setOriginalPrice(order.getOriginalPrice());
        dto.setDiscountAmount(order.getDiscountAmount());
        dto.setCouponCode(order.getCouponCode());
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
    }

    private EventDTO fetchEventDetails(Long eventId) {
        try {
            String url = eventServiceUrl + "/api/events/" + eventId;
            ResponseEntity<ApiResponse<EventDTO>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    new ParameterizedTypeReference<ApiResponse<EventDTO>>() {}
            );

            if (response.getBody() == null || !"SUCCESS".equalsIgnoreCase(response.getBody().getStatus())) {
                return null;
            }
            return response.getBody().getData();
        } catch (RuntimeException exception) {
            return null;
        }
    }
}
