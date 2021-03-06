(function(undefined) {

    'use strict';

    var SCREENSAVER = 'screensaver',
        LOADING = 'loading',
        SLIDE_DELAY = 4000,
        OUTER_PADDING = 40,

        UPVOTE = 'upvote',
        DOWNVOTE = 'downvote',
        NOVOTE = 'no-vote',

        TRACK_VIEWER = 'viewer',

        TRACKING = {
            LAUNCH: 'launch',
            NEXT: 'next',
            PREVIOUS: 'previous',
            SCREENSAVER: 'screensaver',
            CLOSE: 'close',
            UPVOTE: 'upvote',
            DOWNVOTE: 'downvote',
            UNVOTE: 'unvote'
        },

        KEYS = {
            UP: 38,
            DOWN: 40,
            LEFT: 37,
            RIGHT: 39
        };

    RB.ImageViewer = Backbone.View.extend({

        $viewer: $('#viewer'),
        currentIndex: 0,
        allImages: null, // this is a copy of the main image collection except it keeps track of ALL models
        imageLoader: null,

        initialize: function(router, imageCollection) {
            router.addRoute('view', '/view/:id', _.bind(this.navigateToImage, this));
            this.router = router;

            $('body')
                .on('click', 'a.image', _.bind(this._handleImageClick, this))
                .on('click', '.screensaver', _.bind(this.startScreensaver, this));

            this.$window = $(window).on('resize', _.bind(this._resize, this));
            this.$content = this.$viewer.find('.viewer-content');
            this.$next = this.$viewer.find('.next');
            this.$previous = this.$viewer.find('.previous');

            this.imageCollection = imageCollection;
            this.$viewer
                .on('click', '.transport', _.bind(this._handleNavigate, this))
                .on('click', '.close', _.bind(this._hide, this))
                .on('click', '.voter button', _.bind(this._vote, this));

            $(document).on('keyup', _.bind(this._handleKeypress, this));

            this.allImages = new RB.ImageCollection();
            this.allImages.reset(imageCollection.models);
            imageCollection.on('updated', _.bind(this._collectionUpdated, this));
            imageCollection.on('reset', _.bind(this._collectionReset, this));
        },

        _handleImageClick: function(evt) {
            evt.preventDefault();
            this.navigateToImage(evt.currentTarget.getAttribute('data-row'));
            RB._track(TRACK_VIEWER, TRACKING.LAUNCH);
        },

        navigateToImage: function(id) {
            id = typeof id === 'object' ? id.id : id;
            var image = this.allImages.findWhere({ id: parseInt(id, 10) });
            if (image) {
                this.render(image);
            }
        },

        render: function(image) {
            var self = this,
                displayImage = function(force) {
                    if (self._screenSaver || force) {
                        self.$content.html(RB.Templates.imageView(image.attributes));
                        self._show();
                        self.currentIndex = self.allImages.indexOf(image);
                        self.$voter = self.$viewer.find('.voter');

                        if (self._screenSaver) {
                            clearTimeout(self._timer); // just out of caution
                            self._timer = setTimeout(_.bind(self._nextSlide, self), SLIDE_DELAY);
                            self.$viewer.removeClass(LOADING);
                        }
                    }
                };

            // We don't want to appear to hang while in normal browsing mode
            if (this._screenSaver) {
                this.$viewer.addClass(LOADING);
                this.imageLoader = new Image();
                this.imageLoader.onload = displayImage;
                this.imageLoader.src = image.attributes.cdnUrl;
            } else {
                displayImage(true);
            }

        },

        _nextSlide: function() {
            if (this._screenSaver) {
                this.$next.click();
            }
        },

        startScreensaver: function(evt) {
            if (evt) {
                evt.preventDefault();
            }
            RB._track(TRACK_VIEWER, TRACKING.SCREENSAVER);
            this._screenSaver = true;
            this._show();
            this.$viewer.addClass(SCREENSAVER);
            this.currentIndex += 1; // because when we call handle navigate, it's going to subtract 1
            this._handleNavigate();
        },

        _handleNavigate: function(evt) {
            var dir = typeof evt === 'object' && $(evt.target).hasClass('next') ? 1 : -1,
                index = this.currentIndex + dir,
                images = this.imageCollection;

            index = index < 0 ? 0 : index;

            RB._track(TRACK_VIEWER, dir === 1 ? TRACKING.NEXT : TRACKING.PREVIOUS);

            // If we've moved outside of the collection length, fetch more images
            if (index >= this.allImages.length) {
                images.loadNext();
                this.nextOnUpdate = true;
            } else {
                this.render(this.allImages.at(index));
            }

            // Update the nav controls
            if (index === 0) {
                this.$previous.hide();
            } else {
                this.$previous.show();
                this.$next.show();
            }

        },

        _handleKeypress: function(evt) {
            var keyCode = evt.keyCode || evt.charCode;
            if (this.$viewer.is(':visible')) {
                switch (keyCode) {
                    case KEYS.RIGHT:
                        this.$next.click();
                        break;
                    case KEYS.LEFT:
                        this.$previous.click();
                        break;
                    case KEYS.UP:
                        this.$viewer.find('button.upvote').click();
                        break;
                    case KEYS.DOWN:
                        this.$viewer.find('button.downvote').click();
                        break
                }
            }
        },

        _collectionUpdated: function() {
            if (this.imageCollection.length > 0) {
                this.allImages.add(this.imageCollection.models);
                if (this.nextOnUpdate) {
                    this.render(this.allImages.at(this.currentIndex + 1));
                    this.nextOnUpdate = false;
                }
                this.$next.show();
            } else {
                this.$next.hide();
            }
        },

        _collectionReset: function() {
            this.allImages.reset(this.imageCollection.models);
            this.nextOnUpdate = false;
            this.currentIndex = 0;
        },

        _show: function() {
            this.$viewer.fadeIn();
            this._resize();
        },

        _hide: function() {
            this._killSlideshow();
            this.$viewer
                .removeClass(SCREENSAVER)
                .fadeOut();
            RB._track(TRACK_VIEWER, TRACKING.CLOSE);
        },

        _resize: function() {
            this.$content.height(this.$viewer.height() - OUTER_PADDING);
        },

        _killSlideshow: function() {
            clearTimeout(this._timer);
            delete this.imageLoader;
            this._screenSaver = false;
        },

        _vote: function(evt) {
            var $target = $(evt.currentTarget),
                dir = $target.hasClass(UPVOTE) ? 1 : -1,
                existingVote = $target.parent().hasClass(UPVOTE) ? 1 : $target.parent().hasClass(DOWNVOTE) ? -1 : 0,
                image = this.allImages.at(this.currentIndex).attributes,

                // If the clicked vote button and the existing vote condition are the same, the user is unvoting
                submitDir = dir === existingVote ? 0 : dir;

            image.score = parseInt(image.score, 10) + submitDir + existingVote * -1;
            this.$voter.find('.score').text(image.score);

            $.ajax({
                url: '/uas/?action=vote&dir=' + submitDir + '&id=' + image.externalId + '&csrfToken=' + window.csrfToken,
                dataType: 'json'
            });

            this.$voter.removeClass([ UPVOTE, DOWNVOTE, NOVOTE ].join(' '));

            switch (submitDir) {
                case 0:
                    this.$voter.addClass(NOVOTE);
                    RB._track(TRACK_VIEWER, TRACKING.UNVOTE);
                    break;
                case 1:
                    this.$voter.addClass(UPVOTE);
                    RB._track(TRACK_VIEWER, TRACKING.UPVOTE);
                    break;
                case -1:
                    this.$voter.addClass(DOWNVOTE);
                    RB._track(TRACK_VIEWER, TRACKING.DOWNVOTE);
                    break;
            }

            // Update any other item with this reddit ID with the new vote value
            _.each(this.allImages.filter(function(post) {
                return post.attributes.externalId === image.externalId;
            }), function(post) {
                post.attributes.score = image.score;
                post.attributes.userVote = dir;
            });

        }

    });

}())