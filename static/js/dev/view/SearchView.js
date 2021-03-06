(function(undefined) {

    var KEY_ENTER = 13,
        UPDATE_DELAY = 1000,

        NSFW_TOGGLE = 'hideNsfw',
        NSFW_EXPIRES = 365, // cookie is good for a year
        NSFW_DISABLE = 'false',
        NSFW_ENABLE = 'true';

    RB.SearchView = Backbone.View.extend({

        $clearSearch: $('#clearSearch'),
        $searchInput: $('input[name="search"]'),
        $body: $('body'),
        currentParams: {},

        initialize: function(sidebar, imageCollection, sources, router, uploadView) {
            var self = this;

            this.imageCollection = imageCollection;
            this.sidebar = sidebar;
            this.router = router;
            this.$searchInput.on('keypress', _.bind(this._handleSearch, this));
            this.$clearSearch.on('click', _.bind(this.clearSearch, this));

            if (typeof window.filters === 'object') {
                this.currentParams = window.filters;

                // Use a timeout because the app may still be loading
                setTimeout(function() {
                    self._buildBreadCrumb();
                }, 10);
            }

            // Global catch for source select links
            this.$body.on('click', '.singleSourceSearch', _.bind(this.singleSourceSearch, this));
            router.addRoute('search', '/search/', _.bind(this.routeSearch, this));

            // For the "rehost" button when doing reverse image lookup
            this.$body.on('click', '#postImage', _.bind(this._handleRehostClick, this));
            this.uploadView = uploadView;

            this.$body.on('click', '#btnUploadSearch', _.bind(this.uploadSearch, this));

            // TODO - think about whether this really belongs here. Might need a NavView at some point
            $('#showNsfw').on('change', _.bind(this._handleNsfwChange, this));

            this.sources = sources;
            sources.on('update', _.bind(this._handleSourcesUpdate, this));

        },

        initData: function(data) {
            if ('results' in data) {
                this._displayImageSearch(data);
            }
        },

        routeSearch: function(params) {
            params = _.defaults(params, this.currentParams);
            this.currentParams = params;

            // Don't do a request if there's an image specified. There's special processing needed for that
            this.imageCollection.setQueryOption(params, _.has(params, 'imageUri'));

            if (params.imageUri) {
                this._reverseImageSearch(params.imageUri);
            } else {
                this._buildBreadCrumb();
            }

            if (!params.user) {
                this.sidebar.dismiss();
            }

            return this.currentParams;
        },

        clearSearch: function() {
            this.sidebar.dismiss();
            this.imageCollection.clearQueryOptions();
            RB.App.setTitle('');
            this.$searchInput.val('');
            this.$clearSearch.hide();
        },

        singleSourceSearch: function(evt) {
            this.imageCollection.setQueryOption('sources', evt.currentTarget.dataset['id']);
        },

        uploadSearch: function(evt) {

            var image = evt instanceof File ? evt : null,
                self = this,
                nullFunc = function() {};

            new RB.Uploader(nullFunc, _.bind(this._displayImageSearch, this), nullFunc, image, '/images/', true);

        },

        _displayImageSearch: function(data) {
            if (data.results) {
                this.imageCollection.reset(data.results);
                this.sidebar.populate(RB.Templates.imageSearchDetails(data), this);
                RB.App.setTitle('Similar images');
                this.$clearSearch.show();
            }
        },

        _handleNsfwChange: function(evt) {
            if (evt.currentTarget.checked) {
                this.$body.removeClass(NSFW_TOGGLE);
                RB.Cookie.bake('showNsfw', NSFW_ENABLE, NSFW_EXPIRES, '/');
            } else {
                this.$body.addClass(NSFW_TOGGLE);
                RB.Cookie.bake('showNsfw', NSFW_DISABLE, NSFW_EXPIRES, '/');
            }
        },

        _handleSourcesUpdate: function(item) {
            var collections = this.imageCollection,
                self = this;
            clearTimeout(this._delayTimer);
            this._delayTimer = setTimeout(function() {
                var sources = self.sources.collection.where({ checked: true }),
                    updated = [];

                _.each(sources, function(item) {
                    updated.push(item.attributes.value);
                });

                self.router.go('search', { sources: updated.join(',') });

            }, UPDATE_DELAY);
        },

        _handleRehostClick: function(evt) {
            this.uploadView.openWithUpload(evt.target.getAttribute('data-original'));
        },

        // Router entry points
        _handleSearch: function(evt) {
            var self = this,
                keyCode = evt.keyCode || evt.charCode,
                submitSearch = function() {
                    var value = evt.target.value;
                    if (value.indexOf('http') === 0) {
                        // self._reverseImageSearch(value);
                        self.router.go('search', { imageUri: value });
                    } else {
                        // self._querySearch(value);
                        self.router.go('search', { q: value });
                    }
                };

            // Force submit on enter press, otherwise submit after delay
            clearTimeout(this._delayTimer);
            if (keyCode === KEY_ENTER) {
                submitSearch();
            } else {
                this._delayTimer = setTimeout(submitSearch, UPDATE_DELAY);
            }
        },

        _reverseImageSearch: function(url) {
            var images = this.imageCollection,
                self = this,
                progress = RB.Uploader.getGlobalProgress(),

                updateRequest = function() {
                    $.ajax({
                        url: '/upload/?action=status',
                        dataType: 'json',
                        success: requestSuccess
                    });
                },

                requestSuccess = function(data) {

                    if (_.has(data, url)) {
                        progress.progress(Math.round(data[url] * 100));
                    }

                    if (data !== null) {
                        setTimeout(updateRequest, 250);
                    }
                };

            RB.Uploader.showGlobalProgress();
            setTimeout(updateRequest, 1000);

            // We're going to hijack the usual request chain so that reverse image search specific logic can be done
            images.reset();
            images.loadNext(function(data, type) {
                var data = JSON.parse(data),
                    results = data.results;
                self.sidebar.populate(RB.Templates.imageSearchDetails(data), self);
                RB.Uploader.hideGlobalProgress();
                return JSON.stringify(results);
            });

            RB.App.setTitle('Similar images');
            this.$clearSearch.show();
        },

        // not really a bread crumb, but naming things is hard
        _buildBreadCrumb: function() {
            if ('q' in this.currentParams || 'user' in this.currentParams) {
                RB.App.setTitle(RB.Templates.breadcrumb(this.currentParams));
                this.$clearSearch.show();
            }
        }

    });

}());