"use strict"

const request = require("request")


exports.fetchUserProfile = function(userId, callback) {
	request({
		uri:    "https://graph.facebook.com/v2.6/" + encodeURIComponent(userId),
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "GET"
	}, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			callback(error, JSON.parse(body))
		}
		else {
			console.error("Unable to fetch user profile.")
			console.error(response.body)
			console.error(error)
		}
	})
}


exports.sendTextMessage = function(recipientId, text, properties) {
	const data = {
		recipient: { id: recipientId },
		message:   Object.assign({ text: text }, properties)
	}

	request({
		uri:    "https://graph.facebook.com/v2.6/me/messages",
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "POST",
		json:   data
	}, function(error, response) {
		if (!error && response.statusCode === 200) {
			// success
		}
		else {
			console.error("Unable to update messenger profile.")
			console.error(response.body)
			console.error(error)
		}
	})
}


exports.sendGenericTemplate = function(recipientId, properties) {
	const data = {
		recipient: { id: recipientId },
		message:   {
			attachment: {
				type:    "template",
				payload: Object.assign({ template_type: "generic" }, properties)
			}
		}
	}

	request({
		uri:    "https://graph.facebook.com/v2.6/me/messages",
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "POST",
		json:   data
	}, function(error, response) {
		if (!error && response.statusCode === 200) {
			// success
		}
		else {
			console.error("Unable to send message.")
			console.error(response)
			console.error(error)
		}
	})
}


exports.updateMessengerProfile = function(properties) {
	request({
		uri:    "https://graph.facebook.com/v2.6/me/messenger_profile",
		qs:     { access_token: process.env.PAGE_ACCESS_TOKEN },
		method: "POST",
		json:   properties
	}, function(error, response) {
		if (!error && response.statusCode === 200) {
			// success
		}
		else {
			console.error("Unable to send message.")
			console.error(response.body)
			console.error(error)
		}
	})
}
