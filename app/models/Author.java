package models;

import javax.persistence.Entity;

import play.db.jpa.Model;

@Entity
public class Author extends Model {
	public String email, firstName, lastName;

	public Author(String email, String firstName, String lastName) {
		this.email = email;
		this.firstName = firstName;
		this.lastName = lastName;
	}

}
