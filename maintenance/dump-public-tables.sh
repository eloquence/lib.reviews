#!/bin/bash
#
# This script will dump all tables containing only public information, for
# daily dumps with ISO date based names.
#
# It does not dump the user table, since it contains passwords and
# potentially other private data. Using a whitelist also means
# we have to make an explicit choice to add new tables, ensuring
# they've been vetted.
#
# NB: For now deleted content and old revisions _are_ included in these
# dumps.

EXPORTDIR=`dirname $0`/../static/downloads/dumps
ISODATE=`date +"%Y-%m-%d"`
FILENAME="dump-$ISODATE.tgz"

cd $EXPORTDIR
rethinkdb dump -e libreviews.reviews -e libreviews.things -e libreviews.teams -e libreviews.blog_posts -f $FILENAME
ln -s -f $FILENAME latest.tgz