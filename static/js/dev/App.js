/**
 * RedditBooru main app view (controller)
 */
(function(undefined) {

    // Amount of time to wait on user to stop making changes before firing off requests
    var UPDATE_DELAY = 1000;

    RB.Router = Backbone.Router.extend({
        routes: {
            'search/?*params': 'querySearch',
            'user/:userName': '_user'
        }
    });

    RB.AppView = Backbone.View.extend({

        views: {},
        collections: {},
        router: new RB.Router,

        $title: $('#title'),

        _delayTimer: null,

        initialize: function() {

            // Start the router
            Backbone.history.start({
                pushState: true
            });

            this.collections.sources = new RB.QueryOptionCollection();
            this.collections.sources.reset(window.sources);
            this.views.sources = new RB.QueryOptionsView($('#sources'), this.collections.sources);
            this.views.sources.on('update', _.bind(this._handleSourcesUpdate, this));

            this.collections.images = new RB.ImageCollection();
            this.collections.images.reset(window.startUp);
            this.views.images = new RB.ImageView($('#images'), this.collections.images);

            this.views.search = new RB.SearchView(this.collections.images, this.router);

        },

        _handleSourcesUpdate: function(item) {
            var collections = this.collections;
            clearTimeout(this._delayTimer);
            this._delayTimer = setTimeout(function() { 
                var sources = collections.sources.where({ checked: true }),
                    updated = [];

                _.each(sources, function(item) {
                    updated.push(item.attributes.value);
                });

                collections.images.setQueryOption('sources', updated.join(','));
            }, UPDATE_DELAY);
        },

        setTitle: function(title) {
            this.$title.html(title);
            document.title = title + ' - redditbooru';
        }

    });

    // Kick off execution
    RB.App = new RB.AppView();

}());