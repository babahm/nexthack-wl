"use strict"

const api = require("./api")

// TODO we need NLP here :)
// TODO there must be a away to reset the state
// TODO doesn't work if user is both, sender & recipient, at the same time
const states = {
	fetchingUserProfile: {
		handleMessage: function() {
			this.sendTextMessage("One moment please, I'm there for you shortly!")
		}
	},

	neutral: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()
			if (matchingText.indexOf("camera") < 0) {
				return false
			}
			if (matchingText.indexOf("lend") < 0 && matchingText.indexOf("give") < 0) {
				return false
			}

			this.sendTextMessage("Awesome! Can you send me a photo of it?")
			this.state = "sender_waitingForPhoto"
		},

		handlePostback: function(payload, referral) {
			if (payload !== "GET_STARTED") {
				return false
			}

			const that = this
			this.state = "fetchingUserProfile"

			api.fetchUserProfile(this.userId, function(error, sender) {
				const senderFirstName = sender.first_name
				that.sender = sender

				const reference = referral && referral.ref
				if (reference) {
					that.sendTextMessage("Hey " + senderFirstName + ",\nFIXME would like to lend out their camera to you.")
					that.sendTextMessage("The following price covers damage and theft. Is that okay?")
					that.sendGenericTemplate({
						elements: [{
							title:    "Nikon Camera",
							subtitle: "FIXME would like to lend Nikon Camera with you for 2 days.",
							buttons:  [{
								type:  "web_url",
								title: "Accept & Pay",
								url:   "https://www.paypal.com"
							}]
						}]
					})
					that.state = "recipient_waitingForPayment"
				}
				else {
					that.sendTextMessage("Hey " + senderFirstName + ", how can I help you?")
					that.state = "neutral"
				}
			})
		}
	},

	sender_waitingForDuration: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()
			if (matchingText.indexOf("days") < 0) {
				return false
			}

			const that = this

			this.sendTextMessage("Sure, we can do that!")
			setTimeout(function() {
				that.sendTextMessage("Share this link with your friend:")
				that.sendGenericTemplate({
						elements: [{
							image_url: that.imageUrl,
							title:     "Borrow my Nikon Camera!",
							subtitle:  "2 days including damage and theft coverage!",
							buttons:   [{
								type:           "element_share",
								share_contents: {
									attachment: {
										type:    "template",
										payload: {
											template_type: "generic",
											elements:      [{
												image_url: that.imageUrl,
												title:     "Borrow my Nikon Camera!",
												subtitle:  "2 days including damage and theft coverage!",
												buttons:   [{
													"type":  "web_url",
													"title": "Test",
													"url":   "https://www.messenger.com/t/1138492269610888?ref=abc"
												}]
											}]
										}
									}
								}
							}]
						}]
					}
				)
				setTimeout(function() {
					that.sendTextMessage("I’ll write you once your friend has accepted your request.")
				}, 3000)
			}, 1000)
			this.state = "neutral"
		}
	},

	sender_waitingForPhoto: {
		handleMessage: function(_, attachments) {
			if (!attachments || !attachments.length) {
				this.sendTextMessage("You must send me a photo.")
				return
			}

			const attachment = attachments[0]
			if (attachment.type !== "image") {
				this.sendTextMessage("Sorry, but it has to be a photo!")
				return
			}

			const that = this
			this.imageUrl = attachment.payload.url

			this.sendTextMessage("One sec, let me check it out…")
			setTimeout(function() {
				that.sendTextMessage("Cool Nikon! I’d estimate it to be worth $250. Are you okay with that?")
			}, 3000)
			this.state = "sender_waitingForPriceAcceptance"
		}
	},

	sender_waitingForPrice: {
		handleMessage: function(text) {
			const priceMatches = text.match(/\d+/)
			const price = priceMatches && priceMatches[0]
			if (!price) {
				return false
			}

			const that = this

			this.sendTextMessage("Okay, seems reasonable.")
			setTimeout(function() {
				that.sendTextMessage("For how long would you like to lend it out?")
			}, 1000)
			this.state = "sender_waitingForDuration"
		}
	},

	sender_waitingForPriceAcceptance: {
		handleMessage: function(text) {
			const matchingText = text.toLowerCase()

			if (matchingText.indexOf("yes") >= 0) {
				this.sendTextMessage("Excellent! For how long would you like to lend it out?")
				this.state = "sender_waitingForDuration"
			}
			else if (matchingText.indexOf("no") >= 0 || matchingText.indexOf("low") >= 0 || matchingText.indexOf("high") >= 0) {
				this.sendTextMessage("What do you think it's worth?")
				this.state = "sender_waitingForPrice"
			}
			else {
				return false
			}
		}
	}
}


const Conversation = function(userId) {
	this.state = "neutral"
	this.userId = userId
}
module.exports = Conversation

Conversation.prototype.handleMessage = function(text, attachments) {
	const state = states[this.state]
	if (!state) {
		console.error("Invalid conversation state: ", this.state)
		return
	}
	if (state.handleMessage) {
		return state.handleMessage.call(this, text, attachments) !== false
	}
	else {
		return false
		// FIXME
	}
}

// FIXME de-dup
Conversation.prototype.handlePostback = function(payload, referral) {
	const state = states[this.state]
	if (!state) {
		console.error("Invalid conversation state: ", this.state)
		return
	}
	if (state.handlePostback) {
		return state.handlePostback.call(this, payload, referral) !== false
	}
	else {
		return false
		// FIXME
	}
}


Conversation.prototype.sendGenericTemplate = function(properties) {
	api.sendGenericTemplate(this.userId, properties)
}


Conversation.prototype.sendTextMessage = function(message, properties) {
	api.sendTextMessage(this.userId, message, properties)
}
