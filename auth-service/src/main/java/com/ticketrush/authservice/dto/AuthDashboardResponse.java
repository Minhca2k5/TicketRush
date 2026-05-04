package com.ticketrush.authservice.dto;

public class AuthDashboardResponse {

    private long userCount;
    private long adminCount;
    private long customerCount;
    private long maleCount;
    private long femaleCount;
    private long profileCompletionCount;
    private double averageAge;

    public long getUserCount() {
        return userCount;
    }

    public void setUserCount(long userCount) {
        this.userCount = userCount;
    }

    public long getAdminCount() {
        return adminCount;
    }

    public void setAdminCount(long adminCount) {
        this.adminCount = adminCount;
    }

    public long getCustomerCount() {
        return customerCount;
    }

    public void setCustomerCount(long customerCount) {
        this.customerCount = customerCount;
    }

    public long getMaleCount() {
        return maleCount;
    }

    public void setMaleCount(long maleCount) {
        this.maleCount = maleCount;
    }

    public long getFemaleCount() {
        return femaleCount;
    }

    public void setFemaleCount(long femaleCount) {
        this.femaleCount = femaleCount;
    }

    public long getProfileCompletionCount() {
        return profileCompletionCount;
    }

    public void setProfileCompletionCount(long profileCompletionCount) {
        this.profileCompletionCount = profileCompletionCount;
    }

    public double getAverageAge() {
        return averageAge;
    }

    public void setAverageAge(double averageAge) {
        this.averageAge = averageAge;
    }
}
