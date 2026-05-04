package com.ticketrush.authservice.dto;

import com.ticketrush.authservice.model.User;

public class UserResponse {

    private final Long id;
    private final String username;
    private final String email;
    private final User.Role role;
    private final Integer age;
    private final User.Gender gender;

    public UserResponse(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.role = user.getRole();
        this.age = user.getAge();
        this.gender = user.getGender();
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public User.Role getRole() {
        return role;
    }

    public Integer getAge() {
        return age;
    }

    public User.Gender getGender() {
        return gender;
    }
}
