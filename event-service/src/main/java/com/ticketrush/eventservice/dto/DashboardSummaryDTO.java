package com.ticketrush.eventservice.dto;

public class DashboardSummaryDTO {

    private long eventCount;
    private long seatCount;
    private long availableSeats;
    private long lockedSeats;
    private long soldSeats;
    private double occupancyRate;
    private double estimatedRevenue;

    public long getEventCount() {
        return eventCount;
    }

    public void setEventCount(long eventCount) {
        this.eventCount = eventCount;
    }

    public long getSeatCount() {
        return seatCount;
    }

    public void setSeatCount(long seatCount) {
        this.seatCount = seatCount;
    }

    public long getAvailableSeats() {
        return availableSeats;
    }

    public void setAvailableSeats(long availableSeats) {
        this.availableSeats = availableSeats;
    }

    public long getLockedSeats() {
        return lockedSeats;
    }

    public void setLockedSeats(long lockedSeats) {
        this.lockedSeats = lockedSeats;
    }

    public long getSoldSeats() {
        return soldSeats;
    }

    public void setSoldSeats(long soldSeats) {
        this.soldSeats = soldSeats;
    }

    public double getOccupancyRate() {
        return occupancyRate;
    }

    public void setOccupancyRate(double occupancyRate) {
        this.occupancyRate = occupancyRate;
    }

    public double getEstimatedRevenue() {
        return estimatedRevenue;
    }

    public void setEstimatedRevenue(double estimatedRevenue) {
        this.estimatedRevenue = estimatedRevenue;
    }
}
