#!/bin/bash
#
# This script will generate an archive of all uploaded media files.
MEDIADIR=`dirname $0`/../static/uploads
EXPORTDIR=`dirname $0`/../static/downloads/media
ISODATE=`date +"%Y-%m-%d"`
EXPORTPATH="$EXPORTDIR/media-$ISODATE.tgz"
tar cvfz $EXPORTPATH $MEDIADIR
# Update a symlink to the latest copy
ABSEXPORTPATH=$(readlink -f $EXPORTPATH)
ln -s -f $ABSEXPORTPATH $EXPORTDIR/latest.tgz